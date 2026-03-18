// app/[langcode]/tour/[id]/steps.tsx
// Tour steps page — core gameplay

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useToursStore } from '../../../../stores/tours.store';
import { useAuthStore } from '../../../../stores/auth.store';
import { StepTimeline } from '../../../../components/tour/StepTimeline';
import { CompletionPopup } from '../../../../components/tour/CompletionPopup';

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
      // Donation handling — to be integrated with payment service
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {tour.title}
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Progress bar */}
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel}>
            {t('step.progress', {
              completed: stepsCompleted.length,
              total: totalSteps,
            })}
          </Text>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width:
                    totalSteps > 0
                      ? `${(stepsCompleted.length / totalSteps) * 100}%`
                      : '0%',
                },
              ]}
            />
          </View>
        </View>

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
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: AMBER,
    borderRadius: 4,
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
