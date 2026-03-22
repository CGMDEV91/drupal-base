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
import { useToursStore } from '../../../../stores/tours.store';
import { useAuthStore } from '../../../../stores/auth.store';
import { StepTimeline } from '../../../../components/tour/StepTimeline';
import { CompletionPopup } from '../../../../components/tour/CompletionPopup';
import BackButton from '../../../../components/layout/BackButton';
import { CONTENT_MAX_WIDTH } from '../../../../styles/theme';

const AMBER = '#F59E0B';

export default function TourStepsScreen() {
  const { id, langcode } = useLocalSearchParams<{ id: string; langcode: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const user = useAuthStore((s) => s.user);
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

  // Animated progress bar
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Auth guard
  useEffect(() => {
    if (!user) {
      Alert.alert(
        t('auth.required'),
        t('auth.signInPrompt'),
        [{ text: 'OK', onPress: () => router.back() }],
      );
    }
  }, [user]);

  // Load tour detail + activity on mount
  useEffect(() => {
    if (id && user) {
      fetchTourDetail(id, user.id);
    }
  }, [id, user?.id]);

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
      setShowCompletion(false);
      router.replace(`/${langcode}`);
    },
    [langcode, router],
  );

  const handleCloseCompletion = useCallback(() => {
    setShowCompletion(false);
    router.replace(`/${langcode}`);
  }, [langcode, router]);

  if (!user) {
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.backButton}>
          <BackButton color="#374151" bgColor="rgba(0,0,0,0.07)" fallbackRoute={`/${langcode}/tour/${id}`} />
        </View>
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

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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
        />
      </ScrollView>

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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 16 : 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    width: '100%',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 8,
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
    fontWeight: '800',
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
