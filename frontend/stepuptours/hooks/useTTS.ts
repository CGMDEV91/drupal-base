// hooks/useTTS.ts

import { useRef, useState, useCallback, useEffect } from 'react';
import { Animated, Platform } from 'react-native';
import * as Speech from 'expo-speech';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const CHARS_PER_SECOND = 15;

let stopGlobalTTS: (() => void) | null = null;

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

export function useTTS(text: string, langcode: string): UseTTSReturn {
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(1);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const playStateRef = useRef<PlayState>('idle');
  const speedIndexRef = useRef(1);
  const genRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);
  const elapsedAtPauseRef = useRef(0);
  const voiceRef = useRef<Speech.Voice | null>(null);

  const setPlayStateSync = (s: PlayState) => {
    playStateRef.current = s;
    setPlayState(s);
  };

  // ── Voice selection ────────────────────────────────────────────────────────

  const getBestVoice = useCallback(async () => {
    if (voiceRef.current) return voiceRef.current;

    const voices = await Speech.getAvailableVoicesAsync();

    const best = voices
      .filter(v =>
        v.language?.toLowerCase().startsWith(langcode.toLowerCase())
      )
      .sort((a, b) => {
        if (a.quality === 'Enhanced' && b.quality !== 'Enhanced') return -1;
        if (b.quality === 'Enhanced' && a.quality !== 'Enhanced') return 1;

        if (a.identifier?.includes('compact')) return 1;
        if (b.identifier?.includes('compact')) return -1;

        return 0;
      })[0];

    voiceRef.current = best || null;
    return best;
  }, [langcode]);

  // ── Natural rate ──────────────────────────────────────────────────────────

  const getNaturalRate = (lang: string, speed: number) => {
    const baseRates: Record<string, number> = {
      en: 0.95,
      es: 0.9,
      fr: 0.92,
      de: 0.9,
      it: 0.9,
    };
    const base = baseRates[lang.slice(0, 2)] || 0.95;
    const rate = base * speed;
    // On iOS, AVSpeechUtterance default rate is 0.5 (not 1.0).
    // Scale down so the speech sounds natural instead of high-pitched.
    return Platform.OS === 'ios' ? rate * 0.5 : rate;
  };

  // ── Text humanization ─────────────────────────────────────────────────────

  const humanizeText = (t: string) => {
    return t
      .replace(/\./g, '. ')
      .replace(/,/g, ', ')
      .replace(/\n/g, '. ')
      .replace(/:/g, ': ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // ── Timer ─────────────────────────────────────────────────────────────────

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (fromElapsed: number, duration: number) => {
      stopTimer();
      let el = fromElapsed;
      setElapsed(Math.floor(el));
      intervalRef.current = setInterval(() => {
        el += 0.1;
        setElapsed(Math.floor(el));
        progressAnim.setValue(Math.min(el / duration, 1));
        if (el >= duration) stopTimer();
      }, 100);
    },
    [progressAnim, stopTimer]
  );

  // ── Stop ──────────────────────────────────────────────────────────────────

  const handleStop = useCallback(() => {
    genRef.current += 1;
    stopTimer();
    Speech.stop();
    setPlayStateSync('idle');
    setElapsed(0);
    setTotalDuration(0);
    durationRef.current = 0;
    progressAnim.setValue(0);
    elapsedAtPauseRef.current = 0;
    voiceRef.current = null;

    if (stopGlobalTTS === handleStopRef.current) stopGlobalTTS = null;
  }, [progressAnim, stopTimer]);

  const handleStopRef = useRef(handleStop);
  useEffect(() => { handleStopRef.current = handleStop; }, [handleStop]);

  // ── Core speak ────────────────────────────────────────────────────────────

  const speak = useCallback(
    async (fromElapsed: number) => {
      const gen = genRef.current;

      const voice = await getBestVoice();
      const rate = getNaturalRate(
        langcode,
        SPEEDS[speedIndexRef.current]
      );

      const processedText = humanizeText(text);

      const charsRead = Math.floor(fromElapsed * CHARS_PER_SECOND * rate);
      const remaining = processedText.slice(charsRead) || processedText;

      const duration = Math.max(
        1,
        Math.ceil(processedText.length / (CHARS_PER_SECOND * rate))
      );

      durationRef.current = duration;
      setTotalDuration(duration);
      setPlayStateSync('playing');
      startTimer(fromElapsed, duration);

      Speech.speak(remaining, {
        language: langcode,
        voice: voice?.identifier,
        rate,
        pitch: 1.0,
        onDone: () => {
          if (genRef.current !== gen) return;
          setPlayStateSync('idle');
          progressAnim.setValue(1);
          stopTimer();
          if (stopGlobalTTS === handleStopRef.current) stopGlobalTTS = null;
        },
        onError: () => {
          if (genRef.current !== gen) return;
          setPlayStateSync('idle');
          stopTimer();
        },
      });
    },
    [text, langcode, progressAnim, startTimer, stopTimer, getBestVoice]
  );

  // ── Play / Pause ──────────────────────────────────────────────────────────

  const handlePlayPause = useCallback(() => {
    const state = playStateRef.current;

    if (state === 'playing') {
      elapsedAtPauseRef.current = elapsed;
      genRef.current += 1;
      Speech.stop();
      stopTimer();
      setPlayStateSync('paused');
      return;
    }

    if (state === 'paused') {
      genRef.current += 1;
      speak(elapsedAtPauseRef.current);
      return;
    }

    if (stopGlobalTTS && stopGlobalTTS !== handleStopRef.current) stopGlobalTTS();
    stopGlobalTTS = handleStopRef.current;
    genRef.current += 1;
    speak(0);
  }, [elapsed, speak, stopTimer]);

  // ── Speed change ──────────────────────────────────────────────────────────

  const handleSpeedChange = useCallback(() => {
    const newIdx = (speedIndexRef.current + 1) % SPEEDS.length;
    speedIndexRef.current = newIdx;
    setSpeedIndex(newIdx);

    if (playStateRef.current === 'idle') return;

    const currentElapsed = elapsed;
    genRef.current += 1;
    Speech.stop();
    stopTimer();
    speak(currentElapsed);
  }, [elapsed, speak, stopTimer]);

  const prefetch = useCallback(() => {}, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      genRef.current += 1;
      stopTimer();
      Speech.stop();
      if (stopGlobalTTS === handleStopRef.current) stopGlobalTTS = null;
    };
  }, [stopTimer]);

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
