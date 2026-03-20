// components/tour/StarRating.tsx
// Reusable star rating component — display and interactive modes

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const AMBER = '#F59E0B';
const STAR_EMPTY = '#D1D5DB';
const COUNT_GRAY = '#9CA3AF';

interface StarRatingProps {
  rating: number;        // 0-5
  ratingCount?: number;  // number of reviews
  interactive?: boolean; // if true, stars are tappable
  onRate?: (rating: number) => void;
  size?: number;         // star icon size, default 14
}

export function StarRating({
  rating,
  ratingCount,
  interactive = false,
  onRate,
  size = 14,
}: StarRatingProps) {
  const { t } = useTranslation();

  const stars = Array.from({ length: 5 }, (_, i) => {
    const starIndex = i + 1;
    const filled = starIndex <= Math.round(rating);
    const iconName: any = filled ? 'star' : 'star-outline';
    const color = filled ? AMBER : STAR_EMPTY;

    if (interactive) {
      return (
        <TouchableOpacity
          key={starIndex}
          onPress={() => onRate?.(starIndex)}
          hitSlop={4}
          activeOpacity={0.7}
        >
          <Ionicons name={iconName} size={size} color={color} />
        </TouchableOpacity>
      );
    }

    return <Ionicons key={starIndex} name={iconName} size={size} color={color} />;
  });

  const hasRating = rating > 0;

  return (
    <View style={styles.container}>
      <View style={styles.starsRow}>{stars}</View>
      {!interactive && (
        <>
          {hasRating && (
            <Text style={[styles.ratingValue, { fontSize: size - 1 }]}>
              {rating.toFixed(1)}
            </Text>
          )}
          {ratingCount !== undefined && (
            <Text style={[styles.ratingCount, { fontSize: size - 2 }]}>
              ({ratingCount})
            </Text>
          )}
          {!hasRating && ratingCount === undefined && (
            <Text style={[styles.noRating, { fontSize: size - 1 }]}>
              {t('tour.noRating')}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  ratingValue: {
    color: AMBER,
    fontWeight: '600',
    marginLeft: 4,
  },
  ratingCount: {
    color: COUNT_GRAY,
    marginLeft: 2,
  },
  noRating: {
    color: COUNT_GRAY,
    marginLeft: 4,
  },
});
