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

interface TourCardProps {
  tour: Tour;
  cardWidth: number;
  langcode: string;
  isAuthenticated?: boolean;
  isFavorite?: boolean;
  isCompleted?: boolean;
  onToggleFavorite?: () => void;
}

const CARD_IMAGE_RATIO = 0.65;
const AMBER = '#F59E0B';
const META_ICON_COLOR = '#9CA3AF';

export function TourCard({
  tour,
  cardWidth,
  langcode,
  isAuthenticated = false,
  isFavorite = false,
  isCompleted = false,
  onToggleFavorite,
}: TourCardProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const imageHeight = cardWidth * CARD_IMAGE_RATIO;

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
        {tour.image ? (
          <Image
            source={{ uri: tour.image }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.image, { backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 32 }}>🗺️</Text>
          </View>
        )}

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
              size={20}
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
          <StarRating value={tour.averageRate} count={tour.ratingCount} size={13} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
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
    backgroundColor: 'rgba(0,0,0,0.45)',
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
          shadowRadius: 6,
          elevation: 3,
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
});
