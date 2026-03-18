// app/[langcode]/tour/[id].tsx
// Tour detail page

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useToursStore } from '../../../stores/tours.store';
import { useAuthStore } from '../../../stores/auth.store';
import { StarRating } from '../../../components/tour/StarRating';
import { BusinessCard } from '../../../components/tour/BusinessCard';

const AMBER = '#F59E0B';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_HEIGHT = 260;

export default function TourDetailScreen() {
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

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [pendingRating, setPendingRating] = useState(0);

  // Fetch tour detail on mount
  useEffect(() => {
    if (id) {
      fetchTourDetail(id, user?.id);
    }
  }, [id, user?.id]);

  // Show rating prompt when tour is completed but not yet rated
  useEffect(() => {
    if (activity?.isCompleted && !activity.ratedAt) {
      setShowRatingModal(true);
    }
  }, [activity?.isCompleted, activity?.ratedAt]);

  const handleSubmitRating = useCallback(async () => {
    if (!user || !tour || pendingRating === 0) return;
    await updateActivity(user.id, tour.id, { userRating: pendingRating });
    setShowRatingModal(false);
    setPendingRating(0);
  }, [user, tour, pendingRating, updateActivity]);

  const handleDismissRating = useCallback(() => {
    setShowRatingModal(false);
    setPendingRating(0);
  }, []);

  // CTA logic
  const getCtaConfig = useCallback(() => {
    if (!user) {
      return {
        label: t('tour.start'),
        onPress: () => {
          Alert.alert(
            t('auth.required'),
            t('auth.signInPrompt'),
          );
        },
      };
    }

    if (!activity || (!activity.isCompleted && activity.stepsCompleted.length === 0)) {
      return {
        label: t('tour.start'),
        onPress: () => router.push(`/${langcode}/tour/${id}/steps`),
      };
    }

    if (activity.isCompleted || activity.completedAt) {
      return {
        label: t('tour.startAgain'),
        onPress: () => router.push(`/${langcode}/tour/${id}/steps`),
      };
    }

    // Some steps completed but not all
    return {
      label: t('tour.continue'),
      onPress: () => router.push(`/${langcode}/tour/${id}/steps`),
    };
  }, [user, activity, id, langcode, router, t]);

  if (isLoadingDetail || !tour) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  const cta = getCtaConfig();
  const featuredBusinesses = tour.featuredBusinesses.filter(
    (b): b is NonNullable<typeof b> => b !== null,
  );

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Banner */}
        <View style={styles.bannerContainer}>
          {tour.image ? (
            <Image
              source={tour.image}
              style={styles.bannerImage}
              contentFit="cover"
              transition={300}
            />
          ) : (
            <View style={[styles.bannerImage, styles.bannerPlaceholder]}>
              <Ionicons name="image-outline" size={48} color="#9CA3AF" />
            </View>
          )}
          <View style={styles.bannerOverlay} />
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>{tour.title}</Text>
            {(tour.country || tour.city) && (
              <Text style={styles.bannerLocation}>
                {[tour.city?.name, tour.country?.name].filter(Boolean).join(', ')}
              </Text>
            )}
          </View>

          {/* Back button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text style={styles.statText}>
              {tour.duration} {t('tour.duration')}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="footsteps-outline" size={16} color="#6B7280" />
            <Text style={styles.statText}>
              {steps.length} {t('tour.stops')}
            </Text>
          </View>

          <StarRating value={tour.averageRate} count={tour.donationCount} size={14} />
        </View>

        {/* Description */}
        {tour.description ? (
          <View style={styles.section}>
            <Text style={styles.description}>{tour.description}</Text>
          </View>
        ) : null}

        {/* Featured businesses */}
        {featuredBusinesses.length > 0 && (
          <View style={styles.section}>
            {featuredBusinesses.map((business) => (
              <BusinessCard key={business.id} business={business} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* CTA button */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={cta.onPress}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>{cta.label}</Text>
        </TouchableOpacity>
      </View>

      {/* Rating modal */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="fade"
        onRequestClose={handleDismissRating}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('rating.prompt')}</Text>

            <View style={styles.modalStars}>
              <StarRating
                value={pendingRating}
                interactive
                onRate={setPendingRating}
                size={32}
              />
            </View>

            <TouchableOpacity
              style={[styles.modalButton, styles.modalSubmit]}
              onPress={handleSubmitRating}
              activeOpacity={0.8}
              disabled={pendingRating === 0}
            >
              <Text style={styles.modalSubmitText}>{t('rating.submit')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleDismissRating}
              activeOpacity={0.7}
            >
              <Text style={styles.modalSkipText}>{t('rating.skip')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },

  // Banner
  bannerContainer: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerPlaceholder: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  bannerTextContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  bannerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bannerLocation: {
    fontSize: 14,
    color: '#F3F4F6',
    marginTop: 6,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Content
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  description: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },

  // CTA
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  ctaButton: {
    backgroundColor: AMBER,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalStars: {
    marginBottom: 24,
  },
  modalButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSubmit: {
    backgroundColor: AMBER,
    marginBottom: 8,
  },
  modalSubmitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSkipText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
});
