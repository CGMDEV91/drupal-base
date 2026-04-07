// components/tour/TourCard.tsx
// Reusable tour card component with image overlay, rating, favourites, and completion pill

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Tour } from '../../types';
import { StarRating } from './StarRating';
import { imageHeaders } from '../../lib/drupal-client';

interface TourCardProps {
  tour: Tour;
  cardWidth: number;
  langcode: string;
  isAuthenticated?: boolean;
  isFavorite?: boolean;
  isCompleted?: boolean;
  onToggleFavorite?: () => void;
  // Owner-mode props
  isOwner?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const CARD_IMAGE_RATIO = 0.65;
const AMBER = '#F59E0B';
const AMBER_DARK = '#D97706';
const META_ICON_COLOR = '#9CA3AF';

export function TourCard({
  tour,
  cardWidth,
  langcode,
  isAuthenticated = false,
  isFavorite = false,
  isCompleted = false,
  onToggleFavorite,
  isOwner = false,
  onEdit,
  onDelete,
}: TourCardProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const imageHeight = cardWidth * CARD_IMAGE_RATIO;
  const DEFAULT_IMAGES = [
    require('@/assets/images/default-tour-1.jpg'),
    require('@/assets/images/default-tour-2.jpg'),
    require('@/assets/images/default-tour-3.jpg'),
  ];

  // Fuera del componente para que no cambie en cada render
  const hashId = tour.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const stableDefault = DEFAULT_IMAGES[hashId % DEFAULT_IMAGES.length];

  const handlePress = () => {
    router.push(`/${langcode}/tour/${tour.id}`);
  };

  const locationText = [tour.city?.name, tour.country?.name]
    .filter(Boolean)
    .join(', ');

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      style={[styles.card, { width: cardWidth }]}
    >
      {/* Image with overlays */}
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        <Image
          source={tour.image ? { uri: tour.image, headers: imageHeaders } : stableDefault}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />

        {/* Title & location overlay at bottom */}
        <View style={styles.imageOverlay}>
          <Text style={styles.title} numberOfLines={2}>
            {tour.title}
          </Text>
          {locationText ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color="#D1D5DB" />
              <Text style={styles.location} numberOfLines={1}>
                {locationText}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Favourite heart — only for authenticated users with a toggle handler */}
        {isAuthenticated && onToggleFavorite ? (
          <TouchableOpacity
            style={styles.heartButton}
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleFavorite();
            }}
            hitSlop={8}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={18}
              color={isFavorite ? '#EF4444' : '#9CA3AF'}
            />
          </TouchableOpacity>
        ) : null}

        {/* Completed pill — only for authenticated users */}
        {isAuthenticated && isCompleted ? (
          <View style={styles.completedPill}>
            <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
            <Text style={styles.completedText}>{t('step.completed')}</Text>
          </View>
        ) : null}

        {/* Published / Draft pill — owner mode only */}
        {isOwner ? (
          <View style={[styles.statusPill, tour.published ? styles.statusPublished : styles.statusDraft]}>
            <Text style={[styles.statusPillText, tour.published ? styles.statusPublishedText : styles.statusDraftText]}>
              {tour.published ? t('dashboard.tours.published') : t('dashboard.tours.draft')}
            </Text>
          </View>
        ) : null}

        {/* Delete button — owner mode, top-left */}
        {isOwner && onDelete ? (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={(e) => {
              e.stopPropagation?.();
              onDelete();
            }}
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={15} color="#EF4444" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Meta area */}
      <View style={styles.metaArea}>
        {/* Row 1: duration + stops */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color={META_ICON_COLOR} />
            <Text style={styles.metaText}>
              {tour.duration} {t('home.minutes')}
            </Text>
          </View>
          {(tour.stopsCount ?? 0) > 0 && (
            <>
              <Text style={styles.metaSeparator}>·</Text>
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={14} color={META_ICON_COLOR} />
                <Text style={styles.metaText}>
                  {tour.stopsCount} {t('tour.points')}
                </Text>
              </View>
            </>
          )}
        </View>
        {/* Row 2: star rating */}
        <View style={styles.ratingRow}>
          <StarRating rating={tour.averageRate} ratingCount={tour.ratingCount} size={14} />
        </View>

        {/* Edit button — owner mode only */}
        {isOwner && onEdit ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={(e) => {
              e.stopPropagation?.();
              onEdit();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="pencil-outline" size={14} color={AMBER_DARK} />
            <Text style={styles.editButtonText}>{t('dashboard.tours.edit')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    backgroundColor: '#f8f8f8',
    overflow: 'hidden',
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  imageContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 40,
    paddingBottom: 12,
    backgroundImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 1))',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  location: {
    color: '#D1D5DB',
    fontSize: 12,
    flex: 1,
  },
  heartButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 8px rgba(0,0,0,0.18)' } as any
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 4,
        }),
  },
  completedPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  completedText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  metaArea: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaSeparator: {
    fontSize: 12,
    color: '#D1D5DB',
    marginHorizontal: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },

  // ── Owner-mode styles ────────────────────────────────────────────────────────
  deleteButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 6px rgba(0,0,0,0.15)' } as any
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 4,
          elevation: 3,
        }),
  },
  statusPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusPublished: {
    backgroundColor: '#D1FAE5',
  },
  statusDraft: {
    backgroundColor: 'rgba(243,244,246,0.92)',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusPublishedText: {
    color: '#065F46',
  },
  statusDraftText: {
    color: '#6B7280',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 8,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AMBER,
    backgroundColor: '#FFFBEB',
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: AMBER_DARK,
  },
});
