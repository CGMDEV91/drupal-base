// app/[langcode]/tour/[id].tsx
// Tour detail page

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  StyleSheet,
  Share,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useToursStore } from '../../../stores/tours.store';
import { useAuthStore } from '../../../stores/auth.store';
import { StarRating } from '../../../components/tour/StarRating';
import { BusinessCard } from '../../../components/tour/BusinessCard';
import { HtmlText } from '../../../components/ui/HtmlText';
import BackButton from '../../../components/layout/BackButton';
import Footer from '../../../components/layout/Footer';
import { LAYOUT } from '../../../styles/theme';
import { imageHeaders } from '../../../lib/drupal-client';

const AMBER = '#F59E0B';
const BANNER_HEIGHT = 380;

export default function TourDetailScreen() {
  const { id, langcode } = useLocalSearchParams<{ id: string; langcode: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < 768;
  const isDesktop = screenWidth >= 768;

  const user = useAuthStore((s) => s.user);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const {
    currentTour: tour,
    currentSteps: steps,
    currentActivity: activity,
    isLoadingDetail,
    fetchTourDetail,
    updateActivity,
    userActivities,
    toggleFavorite,
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

  const isFavorite = id ? (userActivities[id]?.isFavorite ?? false) : false;

  const handleToggleFavorite = useCallback(() => {
    if (!user) {
      openAuthModal('register');
      return;
    }
    if (id) {
      toggleFavorite(user.id, id);
    }
  }, [user, id, openAuthModal, toggleFavorite]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${tour?.title} - StepUp Tours`,
        url: `https://stepuptours.ddev.site/${langcode}/tour/${id}`,
      });
    } catch {}
  };

  // CTA logic — driven by step count comparison
  const getCtaConfig = useCallback(() => {
    if (!user) {
      return {
        label: t('tour.start'),
        onPress: () => openAuthModal('login'),
      };
    }

    const totalSteps = steps.length;
    const completedCount = activity?.stepsCompleted?.length ?? 0;

    // Never started
    if (!activity) {
      return {
        label: t('tour.start'),
        onPress: () => router.push(`/${langcode}/tour/${id}/steps`),
      };
    }

    // Steps reset after completion — tour still marked completed
    if (completedCount === 0 && (activity.isCompleted || !!activity.completedAt)) {
      return {
        label: t('tour.startAgain'),
        onPress: async () => {
          await updateActivity(user.id, id!, { stepsCompleted: [] });
          router.push(`/${langcode}/tour/${id}/steps`);
        },
      };
    }

    // Genuinely not started
    if (completedCount === 0) {
      return {
        label: t('tour.start'),
        onPress: () => router.push(`/${langcode}/tour/${id}/steps`),
      };
    }

    // All steps completed → offer restart (reset stepsCompleted only, tour stays completed)
    if (totalSteps > 0 && completedCount >= totalSteps) {
      return {
        label: t('tour.startAgain'),
        onPress: async () => {
          await updateActivity(user.id, id!, { stepsCompleted: [] });
          router.push(`/${langcode}/tour/${id}/steps`);
        },
      };
    }

    // Some steps done but not all → continue
    return {
      label: t('tour.continue'),
      onPress: () => router.push(`/${langcode}/tour/${id}/steps`),
    };
  }, [user, activity, steps, id, langcode, router, t, openAuthModal, updateActivity]);

  if (isLoadingDetail || !tour) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  const cta = getCtaConfig();
  const ctaLabel = cta.label;
  const handleStartTour = cta.onPress;
  const currentSteps = steps;
  const featuredBusinesses = tour.featuredBusinesses.filter(
    (b): b is NonNullable<typeof b> => b !== null,
  );

  const DEFAULT_IMAGES = [
    require('@/assets/images/default-tour-1.jpg'),
    require('@/assets/images/default-tour-2.jpg'),
    require('@/assets/images/default-tour-3.jpg'),
  ];

  // Fuera del componente para que no cambie en cada render
  const hashId = tour.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const stableDefault = DEFAULT_IMAGES[hashId % DEFAULT_IMAGES.length];

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        overScrollMode="never"
      >
        {/* Banner */}
        <View style={styles.bannerContainer}>
          <Image
            source={tour.image ? { uri: tour.image, headers: imageHeaders } : stableDefault}
            style={styles.bannerImage}
            contentFit="cover"
            transition={300}
          />
          <View style={styles.bannerOverlay} />
          <View style={styles.bannerTextContainer}>
            <Text style={[styles.bannerTitle, isMobile && { fontSize: 22 }]}>{tour.title}</Text>
            {(tour.country || tour.city) && (
              <View style={styles.bannerLocationRow}>
                <Ionicons name="location-outline" size={14} color="#D1D5DB" />
                <Text style={styles.bannerLocation}>
                  {[tour.city?.name, tour.country?.name].filter(Boolean).join(', ')}
                </Text>
              </View>
            )}
          </View>

          {/* Back button */}
          <View style={styles.backButton}>
            <BackButton color="#FFFFFF" bgColor="rgba(0,0,0,0.35)" size={41} fallbackRoute={`/${langcode}`} />
          </View>

          {/* Heart + Share icons */}
          <View style={styles.topRightActions}>
            <TouchableOpacity style={styles.actionCircle} onPress={handleToggleFavorite}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={22}
                color={isFavorite ? '#EF4444' : '#fff'}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCircle} onPress={handleShare}>
              <Ionicons name="share-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content wrapper — centered on desktop, full-width on mobile */}
        <View style={LAYOUT.contentWrapper}>
          {/* Stats row */}
          <View style={[styles.statsRow, isMobile && styles.statsRowMobile]}>
            <View style={styles.statCard}>
              <View style={[styles.statIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="time" size={22} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.statLabel}>{t('tour.estimatedTime')}</Text>
                <Text style={styles.statValue}>{tour.duration} min</Text>
              </View>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconCircle, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="location" size={22} color="#22C55E" />
              </View>
              <View>
                <Text style={styles.statLabel}>{t('tour.totalPoints')}</Text>
                <Text style={styles.statValue}>{currentSteps.length} {t('tour.points')}</Text>
              </View>
            </View>

            <StarRating value={tour?.averageRate ?? 0} count={tour?.ratingCount} size={18} />
          </View>

          {/* Description */}
          {tour.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>{t('tour.aboutThisTour')}</Text>
              <HtmlText html={tour.description} style={styles.description} />
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

          {/* CTA buttons — always show both, stack on mobile */}
          <View style={[styles.ctaContainer, isMobile && styles.ctaContainerMobile]}>
            <TouchableOpacity style={styles.ctaButton} onPress={handleStartTour}>
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.ctaText}>{ctaLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={18} color="#374151" />
              <Text style={styles.shareButtonText}>{t('tour.share')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Footer />
      </ScrollView>

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
    ...(Platform.OS === 'web' ? { height: '100vh' as any, overflow: 'hidden' as any } : {}),
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
    paddingBottom: 0,
  },

  // Banner
  bannerContainer: {
    width: '100%',
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
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 60,
  },
  bannerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'left',
  },
  bannerLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  bannerLocation: {
    fontSize: 14,
    color: '#E5E7EB',
    textAlign: 'left',
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Top right actions
  topRightActions: {
    position: 'absolute',
    top: 48,
    right: 16,
    flexDirection: 'row',
    gap: 10,
    zIndex: 2,
  },
  actionCircle: {
    width: 41,
    height: 41,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  statsRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 16,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  // Content
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    paddingBottom: 8,
  },

  // CTA
  ctaContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  ctaContainerMobile: {
    flexDirection: 'column',
  },
  ctaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AMBER,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingVertical: 14,
    borderRadius: 12,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
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
