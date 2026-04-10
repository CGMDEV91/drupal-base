// app/[langcode]/tour/[id]/steps.tsx
// Tour steps page — core gameplay

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToursStore } from '../../../../stores/tours.store';
import { useAuthStore } from '../../../../stores/auth.store';
import { getUserById } from '../../../../services/user.service';
import type { User } from '../../../../types';
import { StepTimeline } from '../../../../components/tour/StepTimeline';
import { CompletionPopup } from '../../../../components/tour/CompletionPopup';
import { TourOnboardingModal, ONBOARDING_STORAGE_KEY } from '../../../../components/tour/TourOnboardingModal';
import BackButton from '../../../../components/layout/BackButton';
import { CONTENT_MAX_WIDTH } from '../../../../styles/theme';

const AMBER = '#F59E0B';

export default function TourStepsScreen() {
  const { id, langcode } = useLocalSearchParams<{ id: string; langcode: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const {
    currentTour: tour,
    currentSteps: steps,
    currentActivity: activity,
    isLoadingDetail,
    fetchTourDetail,
    updateActivity,
  } = useToursStore();

  const [showCompletion, setShowCompletion] = useState(false);
  const [xpAwardedBefore, setXpAwardedBefore] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [guideUser, setGuideUser] = useState<User | null>(null);

  // Animated progress bar
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Ref for scroll-to-next-step
  const scrollViewRef = useRef<ScrollView>(null);

  // Auth guard is handled by [langcode]/_layout.tsx which redirects to home
  // when user is null after auth loading completes. Nothing to do here.

  // Load tour detail + activity on mount
  useEffect(() => {
    if (id && user) {
      fetchTourDetail(id, user.id);
    }
  }, [id, user?.id]);

  // Fetch guide user when tour data is available
  useEffect(() => {
    if (tour?.authorId) {
      getUserById(tour.authorId)
        .then(setGuideUser)
        .catch(() => {}); // silent fail — guide card is optional
    }
  }, [tour?.authorId]);

  // Show onboarding on first visit (no completed steps and not dismissed before)
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_STORAGE_KEY).then((value) => {
      if (!value && stepsCompleted.length === 0) {
        setShowOnboarding(true);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track xpAwarded state before completion
  useEffect(() => {
    if (activity) {
      setXpAwardedBefore(activity.xpAwarded);
    }
  }, [activity?.id]);

  const stepsCompleted = activity?.stepsCompleted ?? [];
  const totalSteps = steps.length;

  // Animate progress bar whenever stepsCompleted changes
  useEffect(() => {
    const ratio = totalSteps > 0 ? stepsCompleted.length / totalSteps : 0;
    Animated.timing(progressAnim, {
      toValue: ratio,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [stepsCompleted.length, totalSteps]);

  const handleCompleteStep = useCallback(
    async (stepId: string) => {
      if (!user || !tour) return;

      const newCompleted = [...stepsCompleted, stepId];
      const isLastStep = newCompleted.length >= totalSteps;

      await updateActivity(user.id, tour.id, {
        stepsCompleted: newCompleted,
        ...(isLastStep ? { isCompleted: true } : {}),
      });

      if (isLastStep) {
        setShowCompletion(true);
      }
    },
    [user, tour, stepsCompleted, totalSteps, updateActivity],
  );

  const handleRestart = useCallback(async () => {
    if (!user || !tour) return;
    await updateActivity(user.id, tour.id, {
      stepsCompleted: [],
      isCompleted: false,
    });
  }, [user, tour, updateActivity]);

  const handleRate = useCallback(
    async (rating: number) => {
      if (!user || !tour) return;
      await updateActivity(user.id, tour.id, { userRating: rating });
    },
    [user, tour, updateActivity],
  );

  const handleDonate = useCallback(
    (_amount: number) => {
      // Donation registered — user closes the popup manually via X or "Volver al inicio"
    },
    [],
  );

  const handleCloseCompletion = useCallback(() => {
    setShowCompletion(false);
    router.replace(`/${langcode}`);
  }, [langcode, router]);

  // While auth is restoring, show spinner. Once done, layout redirects if no user.
  if (isAuthLoading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  if (isLoadingDetail || !tour) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  const xp = 20 + 10 * totalSteps;

  return (
    <View style={styles.screen}>
      {/* Header — full-width bar with absolute back button (matches PageBanner pattern) */}
      <View style={styles.headerOuter}>
        <View style={styles.backButtonAbs}>
          <BackButton color="#374151" bgColor="#F3F4F6" fallbackRoute={`/${langcode}/tour/${id}`} />
        </View>
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>{tour.title}</Text>
            <View style={styles.headerCityRow}>
              <Ionicons name="location-outline" size={12} color="#9CA3AF" />
              <Text style={styles.headerCity}>{tour.city?.name}</Text>
            </View>
          </View>
          <View style={styles.headerProgress}>
            <Text style={styles.progressPercent}>{Math.round((stepsCompleted.length / totalSteps) * 100)}%</Text>
            <Text style={styles.progressFraction}>{stepsCompleted.length}/{totalSteps}</Text>
          </View>
        </View>
      </View>
      <View style={styles.progressBarBg}>
        <Animated.View
          style={[
            styles.progressBarFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      <ScrollView ref={scrollViewRef} style={styles.scrollView} contentContainerStyle={styles.scrollContent} bounces={false} overScrollMode="never">
        {/* Restart button */}
        {stepsCompleted.length > 0 && (
          <TouchableOpacity
            style={styles.restartButton}
            onPress={handleRestart}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={18} color={AMBER} />
            <Text style={styles.restartText}>{t('tour.restart')}</Text>
          </TouchableOpacity>
        )}

        {/* Step Timeline */}
        <StepTimeline
          steps={steps}
          stepsCompleted={stepsCompleted}
          onCompleteStep={handleCompleteStep}
          langcode={langcode ?? 'en'}
          tourTitle={tour.title}
          scrollViewRef={scrollViewRef}
        />
      </ScrollView>

      {/* Onboarding Modal */}
      <TourOnboardingModal
        visible={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />

      {/* Completion Popup */}
      <CompletionPopup
        visible={showCompletion}
        tourName={tour.title}
        tourId={tour.id}
        xp={xp}
        isFirstCompletion={!xpAwardedBefore}
        onRate={handleRate}
        onDonate={handleDonate}
        onClose={handleCloseCompletion}
        langcode={langcode ?? 'en'}
        guideId={guideUser?.id}
        guideName={guideUser?.username}
        guideAvatar={guideUser?.avatar ?? null}
        guideRoles={guideUser?.roles}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? { height: '100vh' as any, overflow: 'hidden' as any } : {}),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerOuter: {
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  backButtonAbs: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 48,
    left: 16,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 16 : 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    width: '100%',
  },
  headerInfo: {
    flex: 1,
    paddingLeft: 44,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  headerCityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  headerCity: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  headerProgress: {
    alignItems: 'flex-end',
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F59E0B',
  },
  progressFraction: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    width: '100%',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#E5E7EB',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
  },
  restartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AMBER,
    borderRadius: 8,
  },
  restartText: {
    fontSize: 14,
    fontWeight: '600',
    color: AMBER,
  },
});
