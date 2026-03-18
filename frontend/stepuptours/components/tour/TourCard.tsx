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
  isFavorite?: boolean;
  isCompleted?: boolean;
  onToggleFavorite?: () => void;
}

const CARD_IMAGE_RATIO = 0.65;
const AMBER = '#F59E0B';

export function TourCard({
  tour,
  cardWidth,
  langcode,
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
          <Text style={styles.title} numberOfLines={1}>
            {tour.title}
          </Text>
          {locationText ? (
            <Text style={styles.location} numberOfLines={1}>
              {locationText}
            </Text>
          ) : null}
        </View>

        {/* Favourite heart (only shown when callback provided, i.e. user authenticated) */}
        {onToggleFavorite ? (
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
              size={22}
              color={isFavorite ? '#EF4444' : '#FFFFFF'}
            />
          </TouchableOpacity>
        ) : null}

        {/* Completed pill */}
        {isCompleted ? (
          <View style={styles.completedPill}>
            <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
            <Text style={styles.completedText}>Completed</Text>
          </View>
        ) : null}
      </View>

      {/* Meta row: duration, XP, rating */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color={AMBER} />
          <Text style={styles.metaText}>
            {tour.duration} {t('home.minutes')}
          </Text>
        </View>

        <View style={styles.metaItem}>
          <Ionicons name="flash-outline" size={14} color={AMBER} />
          <Text style={styles.metaText}>
            20 {t('home.xp')}
          </Text>
        </View>

        <StarRating value={tour.averageRate} size={13} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  location: {
    color: '#E5E7EB',
    fontSize: 12,
    marginTop: 2,
  },
  heartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 20,
    padding: 6,
  },
  completedPill: {
    position: 'absolute',
    top: 8,
    left: 8,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
});
