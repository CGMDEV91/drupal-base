// components/tour/StepContent.tsx
// Expanded content for a single tour step — TTS player with amber design

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTTS } from '../../hooks/useTTS';
import { BusinessCard } from './BusinessCard';
import type { TourStep } from '../../types';

const AMBER = '#F59E0B';
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

interface StepContentProps {
  step: TourStep;
  isCompleted: boolean;
  isActive: boolean;
  /** Passed from StepTimeline — stops audio when the card collapses */
  isExpanded: boolean;
  onComplete: () => void;
  langcode: string;
}

interface NavMode {
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  travelmode: string;
}

const NAV_MODES: NavMode[] = [
  { labelKey: 'step.walk', icon: 'walk-outline', travelmode: 'walking' },
  { labelKey: 'step.bike', icon: 'bicycle-outline', travelmode: 'bicycling' },
  { labelKey: 'step.publicTransport', icon: 'bus-outline', travelmode: 'transit' },
  { labelKey: 'step.drive', icon: 'car-outline', travelmode: 'driving' },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function StepContent({
  step,
  isCompleted,
  isActive,
  isExpanded,
  onComplete,
  langcode,
}: StepContentProps) {
  const { t } = useTranslation();

  const [showDescription, setShowDescription] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const playerExpandAnim = useRef(new Animated.Value(0)).current;

  const descriptionText = step.description ?? '';
  // Use the content's actual language for TTS.
  // If the step has no translation for the current UI language, Drupal returns
  // the original content (usually English) — contentLangcode reflects that.
  const ttsLangcode = step.contentLangcode ?? langcode;
  const tts = useTTS(descriptionText, ttsLangcode);

  useEffect(() => {
    if (showDescription) tts.prefetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDescription]);

  // Stop audio when card collapses
  const prevExpandedRef = useRef(isExpanded);
  useEffect(() => {
    if (prevExpandedRef.current && !isExpanded) tts.handleStop();
    prevExpandedRef.current = isExpanded;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  // ---------------------------------------------------------------------------
  // Player panel expand / collapse
  // ---------------------------------------------------------------------------
  const togglePlayer = useCallback(() => {
    const opening = !showPlayer;
    setShowPlayer(opening);

    if (!opening) tts.handleStop();

    Animated.timing(playerExpandAnim, {
      toValue: opening ? 1 : 0,
      duration: opening ? 260 : 180,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  }, [showPlayer, playerExpandAnim]);

  const openNavigation = (travelmode: string) => {
    if (!step.location) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${step.location.lat},${step.location.lon}&travelmode=${travelmode}`;
    Linking.openURL(url).catch(() => {});
  };

  // ---------------------------------------------------------------------------
  // Derived display values
  // ---------------------------------------------------------------------------
  const isPlaying = tts.playState === 'playing';

  return (
    <View style={styles.container}>
      {/* Navigation buttons — 2-column grid */}
      {step.location && (
        <View style={styles.navGrid}>
          {NAV_MODES.map((mode) => (
            <TouchableOpacity
              key={mode.travelmode}
              style={styles.navButton}
              onPress={() => openNavigation(mode.travelmode)}
              activeOpacity={0.7}
            >
              <Ionicons name={mode.icon} size={20} color="#374151" />
              <Text style={styles.navButtonText}>{t(mode.labelKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* "I'm Here" button */}
      <TouchableOpacity
        style={styles.imHereButton}
        onPress={() => setShowDescription((prev) => !prev)}
        activeOpacity={0.7}
      >
        <Ionicons name="location" size={18} color="#FFFFFF" />
        <Text style={styles.imHereText}>{t('step.imHere')}</Text>
      </TouchableOpacity>

      {/* Description card — shown after "I'm Here" */}
      {showDescription && descriptionText ? (
        <View style={styles.descriptionCard}>

          {/* ── TTS toggle button ── */}
          <TouchableOpacity
            style={styles.ttsToggleBtn}
            onPress={togglePlayer}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showPlayer ? 'volume-high' : 'volume-medium-outline'}
              size={15}
              color={AMBER}
            />
            <Text style={styles.ttsToggleBtnText}>{t('step.tts.listen')}</Text>
            <Ionicons
              name={showPlayer ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={AMBER}
            />
          </TouchableOpacity>

          {/* ── Animated TTS player — above the description text ── */}
          <Animated.View
            style={{
              maxHeight: playerExpandAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 110],
              }),
              opacity: playerExpandAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0, 1],
              }),
              overflow: 'hidden',
            }}
          >
            <View style={styles.playerCard}>
              {/* Progress bar: track → fill → thumb */}
              <View style={styles.progressWrapper}>
                <Text style={styles.timeText}>{formatTime(tts.elapsed)}</Text>
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width: tts.progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  >
                    {/* Thumb sits at the right edge of the fill */}
                    <View style={styles.progressThumb} />
                  </Animated.View>
                </View>
                <Text style={styles.timeText}>{formatTime(tts.totalDuration)}</Text>
              </View>

              {/* Controls: Stop | Play/Pause | Speed */}
              <View style={styles.playerControls}>
                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={tts.handleStop}
                  activeOpacity={0.7}
                  accessibilityLabel={t('step.tts.stop')}
                >
                  <Ionicons name="stop" size={17} color="#6B7280" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.playBtn}
                  onPress={tts.handlePlayPause}
                  activeOpacity={0.8}
                  accessibilityLabel={isPlaying ? t('step.tts.pause') : t('step.tts.play')}
                >
                  {tts.playState === 'loading' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons
                      name={isPlaying ? 'pause' : 'play'}
                      size={20}
                      color="#FFFFFF"
                    />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={tts.handleSpeedChange}
                  activeOpacity={0.7}
                >
                  <Text style={styles.speedText}>{SPEEDS[tts.speedIndex]}x</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* ── Description header + text (below player) ── */}
          <View style={styles.descriptionHeader}>
            <Ionicons name="information-circle-outline" size={15} color={AMBER} />
            <Text style={styles.descriptionHeaderText}>{t('step.description')}</Text>
          </View>
          <Text style={styles.descriptionText}>{descriptionText}</Text>
        </View>
      ) : null}

      {/* Featured business */}
      {step.featuredBusiness ? (
        <View style={styles.businessContainer}>
          <BusinessCard business={step.featuredBusiness} />
        </View>
      ) : null}

      {/* Mark as Completed — always at the bottom when active */}
      {isActive && !isCompleted && (
        <TouchableOpacity
          style={styles.completeButton}
          onPress={onComplete}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.completeButtonText}>{t('step.markCompleted')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    gap: 12,
  },

  // Navigation grid
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  navButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
  },
  navButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },

  // I'm Here button
  imHereButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: AMBER,
    borderRadius: 10,
  },
  imHereText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Description card wrapper
  descriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },

  // TTS toggle button
  ttsToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 9,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  ttsToggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },

  // ── Player card — amber/neutral, compact ─────────────────────────────────
  playerCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 2,
  },

  // Progress bar
  progressWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'visible',
  },
  progressFill: {
    height: 4,
    backgroundColor: AMBER,
    borderRadius: 2,
    overflow: 'visible',
  },
  progressThumb: {
    position: 'absolute',
    right: -7,
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: AMBER,
    shadowColor: AMBER,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 2,
  },
  timeText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
    minWidth: 30,
    textAlign: 'center',
  },

  // Controls row
  playerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  controlBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AMBER,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  speedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },

  // Description section
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  descriptionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
  },

  // Business
  businessContainer: {
    marginTop: 4,
  },

  // Mark Completed
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#22C55E',
    borderRadius: 10,
  },
  completeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
