// components/tour/TourOnboardingModal.tsx
// First-visit onboarding modal
// — Mobile: full-screen slide-up with X close + sticky CTA
// — Web: center card (unchanged)

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

export const ONBOARDING_STORAGE_KEY = 'tour_onboarding_done';

interface TourOnboardingModalProps {
  visible: boolean;
  onClose: () => void;
}

const AMBER = '#F59E0B';
const STEPS = [
  {
    icon: 'navigate-outline' as const,
    titleKey: 'onboarding.step1.title',
    descKey: 'onboarding.step1.desc',
  },
  {
    icon: 'location-outline' as const,
    titleKey: 'onboarding.step2.title',
    descKey: 'onboarding.step2.desc',
  },
  {
    icon: 'book-outline' as const,
    titleKey: 'onboarding.step3.title',
    descKey: 'onboarding.step3.desc',
  },
];

function OnboardingContent({
  t,
  dontShow,
  setDontShow,
}: {
  t: (key: string) => string;
  dontShow: boolean;
  setDontShow: (v: boolean) => void;
}) {
  return (
    <>
      {/* Header */}
      <View style={shared.header}>
        <View style={shared.iconWrapper}>
          <Ionicons name="map-outline" size={28} color={AMBER} />
        </View>
        <Text style={shared.title}>{t('onboarding.title')}</Text>
        <Text style={shared.subtitle}>{t('onboarding.subtitle')}</Text>
      </View>

      {/* Steps */}
      <View style={shared.stepsContainer}>
        {STEPS.map((step, index) => (
          <View key={index} style={shared.stepRow}>
            <View style={shared.stepIconWrap}>
              <Ionicons name={step.icon} size={20} color={AMBER} />
            </View>
            <View style={shared.stepText}>
              <Text style={shared.stepTitle}>{t(step.titleKey)}</Text>
              <Text style={shared.stepDesc}>{t(step.descKey)}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Don't show again */}
      <TouchableOpacity
        style={shared.checkboxRow}
        onPress={() => setDontShow(!dontShow)}
        activeOpacity={0.7}
      >
        <View style={[shared.checkbox, dontShow && shared.checkboxChecked]}>
          {dontShow && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
        </View>
        <Text style={shared.checkboxLabel}>{t('onboarding.dontShow')}</Text>
      </TouchableOpacity>
    </>
  );
}

export function TourOnboardingModal({ visible, onClose }: TourOnboardingModalProps) {
  const { t } = useTranslation();
  const [dontShow, setDontShow] = useState(false);

  const handleClose = async () => {
    if (dontShow) {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true').catch(() => {});
    }
    onClose();
  };

  // ── Mobile: full-screen ──────────────────────────────────────────────────────
  if (Platform.OS !== 'web') {
    return (
      <Modal visible={visible} animationType="slide" statusBarTranslucent>
        <SafeAreaView style={native.root}>
          {/* X close button */}
          <TouchableOpacity
            style={native.closeBtn}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={22} color="#374151" />
          </TouchableOpacity>

          {/* Scrollable content */}
          <ScrollView
            style={native.scroll}
            contentContainerStyle={native.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <OnboardingContent t={t} dontShow={dontShow} setDontShow={setDontShow} />
          </ScrollView>

          {/* Sticky CTA */}
          <View style={native.ctaWrap}>
            <TouchableOpacity style={shared.ctaButton} onPress={handleClose} activeOpacity={0.85}>
              <Ionicons name="play-circle-outline" size={20} color="#FFFFFF" />
              <Text style={shared.ctaText}>{t('onboarding.cta')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // ── Web: center card (unchanged) ────────────────────────────────────────────
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={web.overlay}>
        <View style={web.card}>
          <OnboardingContent t={t} dontShow={dontShow} setDontShow={setDontShow} />
          <TouchableOpacity style={shared.ctaButton} onPress={handleClose} activeOpacity={0.85}>
            <Ionicons name="play-circle-outline" size={20} color="#FFFFFF" />
            <Text style={shared.ctaText}>{t('onboarding.cta')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Shared styles (content, used by both variants) ───────────────────────────
const shared = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: 8,
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  stepsContainer: {
    gap: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  stepIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stepText: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  stepDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: AMBER,
    borderColor: AMBER,
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#4B5563',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AMBER,
    borderRadius: 12,
    paddingVertical: 14,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

// ── Native-only styles ────────────────────────────────────────────────────────
const native = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 20,
  },
  ctaWrap: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
});

// ── Web-only styles ───────────────────────────────────────────────────────────
const web = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    gap: 20,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 40px rgba(0,0,0,0.18)' } as any)
      : {}),
  },
});
