// hooks/useTTS.ts

import { useRef, useState, useCallback, useEffect } from 'react';
import { Animated, Platform } from 'react-native';
import { Audio } from 'expo-av';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPEEDS   = [0.75, 1, 1.25, 1.5, 2];
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';
const TTS_BASE = process.env.EXPO_PUBLIC_TTS_URL  ?? '';

// Langcodes without TTS support — no network calls will be made for these.
const NO_TTS_LANGS = new Set(['el']);

// ── In-memory URL cache ───────────────────────────────────────────────────────

const urlCache = new Map<string, string>();

function cacheKey(langcode: string, text: string): string {
  let h = 0;
  const s = langcode + ':' + text;
  for (let i = 0; i < s.length; i++) h = (((h << 5) - h) + s.charCodeAt(i)) | 0;
  return langcode + '-' + Math.abs(h).toString(36);
}

// ── Fetch playable URI ────────────────────────────────────────────────────────
//
// Drupal  → JSON { url: "https://…/tts/hash.mp3" }   (server-cached file)
// Railway → binary audio/mpeg                         (generated on-demand)

interface TtsMeta { tourTitle?: string; stepTitle?: string }

async function fetchPlayableUri(text: string, langcode: string, meta?: TtsMeta): Promise<string> {
  const endpoint = TTS_BASE
    ? `${TTS_BASE}/tts`
    : `${API_BASE}/api/tts`;

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ text, langcode, ...meta }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => String(res.status));
    throw new Error(`TTS ${res.status}: ${msg}`);
  }

  const contentType = res.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (!data?.url) throw new Error('TTS response missing url');
    const audioUrl = data.url as string;

    // Native: expo-av loads cross-origin URLs natively without issues.
    if (Platform.OS !== 'web') return audioUrl;

    // Web: <audio src> to a cross-origin/ngrok URL fails with NotSupportedError
    // because the browser can't send custom headers so ngrok serves its HTML
    // interstitial instead of the MP3. Fetch the binary ourselves and return
    // a same-origin blob URL instead.
    const audioRes = await fetch(audioUrl, {
      headers: { 'ngrok-skip-browser-warning': '1' },
    });
    if (!audioRes.ok) throw new Error(`Audio fetch ${audioRes.status}`);
    const audioBuf = await audioRes.arrayBuffer();
    return URL.createObjectURL(new Blob([audioBuf], { type: 'audio/mpeg' }));
  }

  // Railway binary fallback
  const buffer = await res.arrayBuffer();
  if (Platform.OS === 'web') {
    return URL.createObjectURL(new Blob([buffer], { type: 'audio/mpeg' }));
  }
  const bytes = new Uint8Array(buffer);
  let binary  = '';
  const chunk = 1024;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...(bytes.subarray(i, i + chunk) as unknown as number[]));
  }
  return `data:audio/mpeg;base64,${btoa(binary)}`;
}

// ── Audio mode (iOS silent mode) ──────────────────────────────────────────────

let audioModeReady = false;
async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS:    true,
    allowsRecordingIOS:      false,
    staysActiveInBackground: false,
    shouldDuckAndroid:       true,
  });
  audioModeReady = true;
}

// ── Global lock ───────────────────────────────────────────────────────────────

let stopGlobalTTS: (() => void) | null = null;

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlayState = 'idle' | 'loading' | 'playing' | 'paused';

export interface UseTTSReturn {
  playState:         PlayState;
  elapsed:           number;
  totalDuration:     number;
  progressAnim:      Animated.Value;
  speedIndex:        number;
  prefetch:          () => void;
  handlePlayPause:   () => void;
  handleStop:        () => void;
  handleSpeedChange: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTTS(text: string, langcode: string, meta?: TtsMeta): UseTTSReturn {
  const [playState,     setPlayState]     = useState<PlayState>('idle');
  const [elapsed,       setElapsed]       = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [speedIndex,    setSpeedIndex]    = useState(1);

  const progressAnim   = useRef(new Animated.Value(0)).current;
  const speedIndexRef  = useRef(1);
  const playStateRef   = useRef<PlayState>('idle');
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefetchingRef = useRef(false);
  const key            = cacheKey(langcode, text);

  // Platform refs
  const soundRef      = useRef<Audio.Sound | null>(null);
  const webAudioRef   = useRef<HTMLAudioElement | null>(null);
  // Pre-loaded element: audio.load() called in prefetch so play() works within
  // the gesture window on first click (no async gap before play).
  const webPreloadRef = useRef<HTMLAudioElement | null>(null);
  // In-flight fetch: shared between prefetch() and getUri() to avoid duplicate
  // Drupal/Railway requests when the user clicks play before prefetch finishes.
  const inflightRef   = useRef<Promise<string> | null>(null);

  const setPlayStateSync = useCallback((s: PlayState) => {
    playStateRef.current = s;
    setPlayState(s);
  }, []);

  // ── Interval helpers ──────────────────────────────────────────────────────

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startProgressPolling = useCallback(() => {
    stopInterval();
    intervalRef.current = setInterval(async () => {
      if (!soundRef.current) { stopInterval(); return; }
      try {
        const status = await soundRef.current.getStatusAsync();
        if (!status.isLoaded) return;
        const pos = (status.positionMillis ?? 0) / 1000;
        const dur = (status.durationMillis ?? 0) / 1000;
        setElapsed(Math.floor(pos));
        if (dur > 0) {
          setTotalDuration(Math.floor(dur));
          progressAnim.setValue(Math.min(pos / dur, 1));
        }
        if (status.didJustFinish) {
          setPlayStateSync('idle');
          progressAnim.setValue(1);
          stopInterval();
          if (stopGlobalTTS === handleStopRef.current) stopGlobalTTS = null;
        }
      } catch {}
    }, 250);
  }, [progressAnim, setPlayStateSync, stopInterval]);

  // ── Unload ────────────────────────────────────────────────────────────────

  const unloadSound = useCallback(async () => {
    stopInterval();
    if (Platform.OS === 'web') {
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        webAudioRef.current.src          = '';
        webAudioRef.current.onended      = null;
        webAudioRef.current.ontimeupdate = null;
        webAudioRef.current = null;
      }
    } else {
      if (soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
      }
    }
  }, [stopInterval]);

  // ── Stop ──────────────────────────────────────────────────────────────────

  const handleStop = useCallback(() => {
    unloadSound();
    setPlayStateSync('idle');
    setElapsed(0);
    setTotalDuration(0);
    progressAnim.setValue(0);
    if (stopGlobalTTS === handleStopRef.current) stopGlobalTTS = null;
  }, [progressAnim, setPlayStateSync, unloadSound]);

  const handleStopRef = useRef(handleStop);
  useEffect(() => { handleStopRef.current = handleStop; }, [handleStop]);

  // ── Get URI ───────────────────────────────────────────────────────────────
  // Checks cache first, then reuses any in-flight promise (shared with prefetch)
  // to avoid making two concurrent requests to Drupal/Railway.
  // Bails out immediately for unsupported langcodes — no network call is made.

  const getUri = useCallback(async (): Promise<string> => {
    if (NO_TTS_LANGS.has(langcode)) throw new Error(`TTS not supported for language: ${langcode}`);

    if (urlCache.has(key)) return urlCache.get(key)!;

    if (inflightRef.current) return inflightRef.current;

    inflightRef.current = fetchPlayableUri(text, langcode, meta)
      .then((uri) => { urlCache.set(key, uri); return uri; })
      .finally(() => { inflightRef.current = null; });

    return inflightRef.current;
  }, [key, text, langcode]);

  // ── Prefetch ──────────────────────────────────────────────────────────────

  const prefetch = useCallback(() => {
    // Never make a network request for unsupported langcodes.
    if (NO_TTS_LANGS.has(langcode)) return;

    if (urlCache.has(key) || prefetchingRef.current) return;
    prefetchingRef.current = true;

    getUri()
      .then((uri) => {
        if (Platform.OS === 'web' && !webPreloadRef.current && !webAudioRef.current) {
          const audio       = new (window as any).Audio() as HTMLAudioElement;
          audio.preload     = 'auto';
          audio.src         = uri;
          audio.load();
          webPreloadRef.current = audio;
        }
      })
      .catch(() => {})
      .finally(() => { prefetchingRef.current = false; });
  }, [key, getUri, langcode]);

  // ── Web helpers ───────────────────────────────────────────────────────────

  /** Attach timeupdate/ended listeners to an audio element. */
  const attachWebListeners = useCallback((audio: HTMLAudioElement) => {
    audio.ontimeupdate = () => {
      const pos = audio.currentTime;
      const dur = audio.duration;
      setElapsed(Math.floor(pos));
      if (dur > 0 && isFinite(dur)) {
        setTotalDuration(Math.floor(dur));
        progressAnim.setValue(Math.min(pos / dur, 1));
      }
    };
    audio.onended = () => {
      setPlayStateSync('idle');
      progressAnim.setValue(1);
      if (stopGlobalTTS === handleStopRef.current) stopGlobalTTS = null;
    };
  }, [progressAnim, setPlayStateSync]);

  // ── Web: load via URL (async path — gesture may expire during fetch) ───────

  const loadAndPlayWeb = useCallback(async () => {
    const uri = await getUri();
    await unloadSound();

    const audio = new (window as any).Audio(uri) as HTMLAudioElement;
    audio.playbackRate  = SPEEDS[speedIndexRef.current];
    webAudioRef.current = audio;
    attachWebListeners(audio);

    try {
      await audio.play();
      setPlayStateSync('playing');
    } catch (e: any) {
      // NotAllowedError: gesture expired during fetch. webAudioRef is set so
      // the next click (fresh gesture) will play immediately via the pause path.
      if (e?.name !== 'NotAllowedError') {
        console.error('[TTS] audio.play error:', e);
        throw e;
      }
      setPlayStateSync('idle');
    }
  }, [attachWebListeners, getUri, setPlayStateSync, unloadSound]);

  // ── Native: expo-av ───────────────────────────────────────────────────────

  const loadAndPlayNative = useCallback(async () => {
    await ensureAudioMode();
    const uri = await getUri();
    await unloadSound();

    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false });
    soundRef.current = sound;
    try { await sound.setRateAsync(SPEEDS[speedIndexRef.current], true); } catch {}
    await sound.playAsync();
    setPlayStateSync('playing');
    startProgressPolling();
  }, [getUri, setPlayStateSync, startProgressPolling, unloadSound]);

  // ── Play / Pause ──────────────────────────────────────────────────────────

  const handlePlayPause = useCallback(async () => {
    // Never attempt playback for unsupported langcodes.
    if (NO_TTS_LANGS.has(langcode)) return;

    if (playStateRef.current === 'loading') return;

    if (Platform.OS === 'web') {
      const audio = webAudioRef.current;

      if (!audio) {
        // ── First play ──────────────────────────────────────────────────────
        // Grab webPreloadRef.current HERE, synchronously, before any await.
        // This keeps the browser gesture token alive so play() won't throw
        // NotAllowedError even if the audio generation took several seconds.
        const preloaded = webPreloadRef.current;
        webPreloadRef.current = null;

        if (stopGlobalTTS && stopGlobalTTS !== handleStopRef.current) stopGlobalTTS();
        stopGlobalTTS = handleStopRef.current;

        if (preloaded) {
          // Audio already fetched and loaded — play with no async gap.
          preloaded.playbackRate  = SPEEDS[speedIndexRef.current];
          webAudioRef.current     = preloaded;
          attachWebListeners(preloaded);
          setPlayStateSync('loading');
          try {
            await preloaded.play();
            setPlayStateSync('playing');
          } catch (e: any) {
            if (e?.name !== 'NotAllowedError') console.error('[TTS] preloaded.play error:', e);
            setPlayStateSync('idle');
          }
          return;
        }

        // No pre-loaded element (prefetch still running or not started).
        // Gesture may expire during the Drupal fetch; second click will play.
        setPlayStateSync('loading');
        try { await loadAndPlayWeb(); } catch { setPlayStateSync('idle'); }
        return;
      }

      // ── Pause / Resume ──────────────────────────────────────────────────────
      if (!audio.paused) {
        audio.pause();
        setPlayStateSync('paused');
      } else {
        try { await audio.play(); setPlayStateSync('playing'); }
        catch { setPlayStateSync('idle'); }
      }
      return;
    }

    // ── Native ──────────────────────────────────────────────────────────────────
    if (!soundRef.current) {
      if (stopGlobalTTS && stopGlobalTTS !== handleStopRef.current) stopGlobalTTS();
      stopGlobalTTS = handleStopRef.current;
      setPlayStateSync('loading');
      try { await loadAndPlayNative(); } catch { setPlayStateSync('idle'); }
      return;
    }

    try {
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) return;

      if (status.isPlaying) {
        try { await soundRef.current.pauseAsync(); } catch {}
        stopInterval();
        setPlayStateSync('paused');
      } else {
        try { await soundRef.current.playAsync(); } catch {}
        setPlayStateSync('playing');
        startProgressPolling();
      }
    } catch {
      await unloadSound();
      setPlayStateSync('idle');
    }
  }, [attachWebListeners, langcode, loadAndPlayNative, loadAndPlayWeb, setPlayStateSync, startProgressPolling, stopInterval, unloadSound]);

  // ── Speed change ──────────────────────────────────────────────────────────

  const handleSpeedChange = useCallback(async () => {
    const newIdx          = (speedIndexRef.current + 1) % SPEEDS.length;
    speedIndexRef.current = newIdx;
    setSpeedIndex(newIdx);

    if (Platform.OS === 'web') {
      if (webAudioRef.current) webAudioRef.current.playbackRate = SPEEDS[newIdx];
    } else if (soundRef.current) {
      try { await soundRef.current.setRateAsync(SPEEDS[newIdx], true); } catch {}
    }
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      unloadSound();
      if (webPreloadRef.current) {
        webPreloadRef.current.src = '';
        webPreloadRef.current     = null;
      }
    };
  }, [unloadSound]);

  return { playState, elapsed, totalDuration, progressAnim, speedIndex, prefetch, handlePlayPause, handleStop, handleSpeedChange };
}
