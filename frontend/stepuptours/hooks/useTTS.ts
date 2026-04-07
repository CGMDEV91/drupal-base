// hooks/useTTS.ts

import { useRef, useState, useCallback, useEffect } from 'react';
import { Animated, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { getCachedAudio, setCachedAudio, ttsCacheKey } from '../lib/ttsCache';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// ── Global audio cache (persiste entre montajes del componente) ───────────────
// Clave: `${langcode}:${text}` → URI lista para reproducir

const audioCache = new Map<string, string>();

// ── Audio mode (iOS silent mode fix) ─────────────────────────────────────────

let audioModeReady = false;
async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  });
  audioModeReady = true;
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchTTSAudio(text: string, langcode: string): Promise<ArrayBuffer> {
  const url = `${API_BASE_URL}/api/tts`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, langcode }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => String(res.status));
    throw new Error(`TTS proxy ${res.status}: ${msg}`);
  }
  return res.arrayBuffer();
}

// ── ArrayBuffer → base64 ──────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 1024;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...(chunk as unknown as number[]));
  }
  return btoa(binary);
}

// ── ArrayBuffer → URI reproducible ────────────────────────────────────────────
// Web   → blob URL  (HTMLAudioElement)
// Nativo → data URI base64 (expo-av, no requiere escritura a disco)

async function audioBufferToUri(buffer: ArrayBuffer): Promise<string> {
  if (Platform.OS === 'web') {
    const blob = new Blob([buffer], { type: 'audio/mpeg' });
    return URL.createObjectURL(blob);
  }
  // expo-av acepta data URIs desde v13+; evita FileSystem.writeAsStringAsync
  const base64 = arrayBufferToBase64(buffer);
  return `data:audio/mpeg;base64,${base64}`;
}

// ── Global lock (solo un TTS activo a la vez) ─────────────────────────────────

let stopGlobalTTS: (() => void) | null = null;

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlayState = 'idle' | 'loading' | 'playing' | 'paused';

export interface UseTTSReturn {
  playState: PlayState;
  elapsed: number;
  totalDuration: number;
  progressAnim: Animated.Value;
  speedIndex: number;
  prefetch: () => void;
  handlePlayPause: () => void;
  handleStop: () => void;
  handleSpeedChange: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTTS(text: string, langcode: string): UseTTSReturn {
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(1);

  const progressAnim = useRef(new Animated.Value(0)).current;

  // Refs de estado compartido
  const speedIndexRef  = useRef(1);
  const playStateRef   = useRef<PlayState>('idle');
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefetchingRef = useRef(false); // evita doble fetch simultáneo

  // Refs de audio por plataforma
  const soundRef    = useRef<Audio.Sound | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);

  const cacheKey = ttsCacheKey(langcode, text);

  const setPlayStateSync = useCallback((s: PlayState) => {
    playStateRef.current = s;
    setPlayState(s);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────

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
      } catch {
        // expo-av puede lanzar si el sonido se descarga en mitad del poll
      }
    }, 250);
  }, [progressAnim, setPlayStateSync, stopInterval]);

  // ── Unload ────────────────────────────────────────────────────────────────

  const unloadSound = useCallback(async () => {
    stopInterval();
    if (Platform.OS === 'web') {
      if (webAudioRef.current) {
        webAudioRef.current.pause();
        webAudioRef.current.src = '';
        webAudioRef.current.onended = null;
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

  // ── Fetch + caché ─────────────────────────────────────────────────────────

  const fetchAudioUri = useCallback(async (): Promise<string> => {
    // 1. In-memory cache (fastest, current session)
    if (audioCache.has(cacheKey)) return audioCache.get(cacheKey)!;

    // 2. Persistent cache (IndexedDB on web / FileSystem on native)
    const cached = await getCachedAudio(cacheKey);
    if (cached) {
      const uri = await audioBufferToUri(cached);
      audioCache.set(cacheKey, uri);
      return uri;
    }

    // 3. Fetch from backend
    const buffer = await fetchTTSAudio(text, langcode);
    const uri = await audioBufferToUri(buffer);
    audioCache.set(cacheKey, uri);

    // 4. Save to persistent cache (fire-and-forget)
    setCachedAudio(cacheKey, buffer).catch(() => {});

    return uri;
  }, [cacheKey, text, langcode]);

  // ── Prefetch (llámalo lo antes posible) ───────────────────────────────────

  const prefetch = useCallback(() => {
    // Ya en caché o ya hay un fetch en vuelo → no hacer nada
    if (audioCache.has(cacheKey) || prefetchingRef.current) return;
    prefetchingRef.current = true;
    fetchAudioUri()
      .catch(() => {})
      .finally(() => { prefetchingRef.current = false; });
  }, [cacheKey, fetchAudioUri]);

  // ── Web: HTMLAudioElement ─────────────────────────────────────────────────

  const loadAndPlayWeb = useCallback(async () => {
    const uri = await fetchAudioUri();
    await unloadSound();

    const audio = new (window as any).Audio(uri) as HTMLAudioElement;
    audio.playbackRate = SPEEDS[speedIndexRef.current];
    webAudioRef.current = audio;

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

    await audio.play();
    setPlayStateSync('playing');
  }, [fetchAudioUri, progressAnim, setPlayStateSync, unloadSound]);

  // ── Nativo: expo-av ───────────────────────────────────────────────────────

  const loadAndPlayNative = useCallback(async () => {
    await ensureAudioMode();

    const uri = await fetchAudioUri(); // desde caché si ya se prefetcheó
    await unloadSound();

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: false },
    );

    soundRef.current = sound;
    try { await sound.setRateAsync(SPEEDS[speedIndexRef.current], true); } catch {}
    await sound.playAsync();
    setPlayStateSync('playing');
    startProgressPolling();
  }, [fetchAudioUri, setPlayStateSync, startProgressPolling, unloadSound]);

  // ── Play / Pause ──────────────────────────────────────────────────────────

  const handlePlayPause = useCallback(async () => {
    // ── Web ───────────────────────────────────────────────────────────────
    if (Platform.OS === 'web') {
      const audio = webAudioRef.current;

      if (!audio) {
        if (stopGlobalTTS && stopGlobalTTS !== handleStopRef.current) stopGlobalTTS();
        stopGlobalTTS = handleStopRef.current;
        setPlayStateSync('loading');
        await loadAndPlayWeb();
        return;
      }

      if (!audio.paused) {
        audio.pause();
        setPlayStateSync('paused');
      } else {
        await audio.play();
        setPlayStateSync('playing');
      }
      return;
    }

    // ── Nativo ────────────────────────────────────────────────────────────
    if (!soundRef.current) {
      if (stopGlobalTTS && stopGlobalTTS !== handleStopRef.current) stopGlobalTTS();
      stopGlobalTTS = handleStopRef.current;
      setPlayStateSync('loading');
      await loadAndPlayNative();
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
  }, [
    loadAndPlayNative,
    loadAndPlayWeb,
    setPlayStateSync,
    startProgressPolling,
    stopInterval,
    unloadSound,
  ]);

  // ── Speed change ──────────────────────────────────────────────────────────

  const handleSpeedChange = useCallback(async () => {
    const newIdx = (speedIndexRef.current + 1) % SPEEDS.length;
    speedIndexRef.current = newIdx;
    setSpeedIndex(newIdx);

    if (Platform.OS === 'web') {
      if (webAudioRef.current) webAudioRef.current.playbackRate = SPEEDS[newIdx];
    } else if (soundRef.current) {
      try { await soundRef.current.setRateAsync(SPEEDS[newIdx], true); } catch {}
    }
  }, []);

  // ── Cleanup al desmontar ──────────────────────────────────────────────────
  // Nota: NO limpiamos audioCache aquí — es intencional para que persista
  // entre montajes del mismo step.

  useEffect(() => {
    return () => { unloadSound(); };
  }, [unloadSound]);

  return {
    playState,
    elapsed,
    totalDuration,
    progressAnim,
    speedIndex,
    prefetch,
    handlePlayPause,
    handleStop,
    handleSpeedChange,
  };
}
