// components/tour/StepContent.tsx
// Expanded content for a single tour step

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Speech from 'expo-speech';
import { BusinessCard } from './BusinessCard';
import type { TourStep } from '../../types';

const AMBER = '#F59E0B';

interface StepContentProps {
  step: TourStep;
  isCompleted: boolean;
  isActive: boolean;
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

export function StepContent({
  step,
  isCompleted,
  isActive,
  onComplete,
  langcode,
}: StepContentProps) {
  const { t } = useTranslation();
  const [showDescription, setShowDescription] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const openNavigation = (travelmode: string) => {
    if (!step.location) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${step.location.lat},${step.location.lon}&travelmode=${travelmode}`;
    Linking.openURL(url).catch(() => {});
  };

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
        <Text style={styles.imHereText}>
          {t('step.imHere')}
        </Text>
      </TouchableOpacity>

      {/* Description text — shown after "I'm Here" */}
      {showDescription && step.description ? (
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>{step.description}</Text>
          <View style={styles.ttsRow}>
            <TouchableOpacity
              style={[styles.ttsButton, isSpeaking && styles.ttsButtonDisabled]}
              onPress={() => {
                Speech.speak(step.description ?? '', { language: langcode });
                setIsSpeaking(true);
              }}
              disabled={isSpeaking}
              accessibilityLabel={t('step.tts.play')}
            >
              <Text style={styles.ttsButtonText}>▶</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ttsButton, !isSpeaking && styles.ttsButtonDisabled]}
              onPress={() => {
                Speech.pause();
                setIsSpeaking(false);
              }}
              disabled={!isSpeaking}
              accessibilityLabel={t('step.tts.pause')}
            >
              <Text style={styles.ttsButtonText}>⏸</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ttsButton, !isSpeaking && styles.ttsButtonDisabled]}
              onPress={() => {
                Speech.stop();
                setIsSpeaking(false);
              }}
              disabled={!isSpeaking}
              accessibilityLabel={t('step.tts.stop')}
            >
              <Text style={styles.ttsButtonText}>⏹</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Featured business */}
      {step.featuredBusiness ? (
        <View style={styles.businessContainer}>
          <BusinessCard business={step.featuredBusiness} />
        </View>
      ) : null}

      {/* Mark as Completed button — only for active step */}
      {isActive && !isCompleted && (
        <TouchableOpacity
          style={styles.completeButton}
          onPress={onComplete}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.completeButtonText}>
            {t('step.markCompleted')}
          </Text>
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
  imHereButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    borderWidth: 0,
  },
  imHereText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  descriptionContainer: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: AMBER,
  },
  descriptionText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  ttsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  ttsButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttsButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  ttsButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  businessContainer: {
    marginTop: 4,
  },
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
