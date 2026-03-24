// hooks/useTTS.ts
// Classic TTS hook using expo-speech.
// langcode is the actual language of the content — if the step has no translation
// for the current UI language, the caller passes the original content language
// (usually 'en') so the TTS engine uses the right voice.

import { useRef, useState, useCallback, useEffect } from 'react';
import { Animated } from 'react-native';
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

  const setPlayStateSync = (s: PlayState) => {
    playStateRef.current = s;
    setPlayState(s);
  };

  // ── Timer ──────────────────────────────────────────────────────────────────

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

  // ── Stop ───────────────────────────────────────────────────────────────────

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
    if (stopGlobalTTS === handleStopRef.current) stopGlobalTTS = null;
  }, [progressAnim, stopTimer]);

  const handleStopRef = useRef(handleStop);
  useEffect(() => { handleStopRef.current = handleStop; }, [handleStop]);

  // ── Core speak ─────────────────────────────────────────────────────────────

  const speak = useCallback(
    (fromElapsed: number) => {
      const gen = genRef.current;
      const rate = SPEEDS[speedIndexRef.current];
      const charsRead = Math.floor(fromElapsed * CHARS_PER_SECOND * rate);
      const remaining = text.slice(charsRead) || text;
      const duration = Math.max(1, Math.ceil(text.length / (CHARS_PER_SECOND * rate)));

      durationRef.current = duration;
      setTotalDuration(duration);
      setPlayStateSync('playing');
      startTimer(fromElapsed, duration);

      Speech.speak(remaining, {
        language: langcode,
        rate,
        onDone: () => {
          if (genRef.current !== gen) return;
          setPlayStateSync('idle');
          progressAnim.setValue(1);
          stopTimer();
          if (stopGlobalTTS === handleStopRef.current) stopGlobalTTS = null;
        },
        onStopped: () => { /* handled by handleStop / pause */ },
        onError: () => {
          if (genRef.current !== gen) return;
          setPlayStateSync('idle');
          stopTimer();
        },
      });
    },
    [text, langcode, progressAnim, startTimer, stopTimer]
  );

  // ── Play / Pause ───────────────────────────────────────────────────────────

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

    // Start fresh
    if (stopGlobalTTS && stopGlobalTTS !== handleStopRef.current) stopGlobalTTS();
    stopGlobalTTS = handleStopRef.current;
    genRef.current += 1;
    speak(0);
  }, [elapsed, speak, stopTimer]);

  // ── Speed change ───────────────────────────────────────────────────────────

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

  // ── Prefetch (no-op for expo-speech) ──────────────────────────────────────

  const prefetch = useCallback(() => {}, []);

  // ── Cleanup ────────────────────────────────────────────────────────────────

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
