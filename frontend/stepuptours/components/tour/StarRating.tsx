// components/tour/StarRating.tsx
// Reusable star rating component — display and interactive modes
//
// NOTE: The translation key `tour.noRating` must exist in your i18n locale files.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const AMBER = '#F59E0B';
const GRAY = '#D1D5DB';

interface StarRatingProps {
  value: number;         // 0-5
  count?: number;        // number of reviews
  interactive?: boolean; // if true, stars are tappable
  onRate?: (rating: number) => void;
  size?: number;         // star icon size, default 13
}

export function StarRating({
  value,
  count,
  interactive = false,
  onRate,
  size = 13,
}: StarRatingProps) {
  const { t } = useTranslation();

  const stars = Array.from({ length: 5 }, (_, i) => {
    const starIndex = i + 1;
    const filled = starIndex <= Math.round(value);
    const iconName = filled ? 'star' : 'star-outline';
    const color = filled ? AMBER : GRAY;

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

  const hasRating = value > 0;

  return (
    <View style={styles.container}>
      <View style={styles.starsRow}>{stars}</View>
      {!interactive && (
        <Text style={[styles.label, { fontSize: size - 1 }]}>
          {hasRating
            ? `${value.toFixed(1)}${count !== undefined ? ` (${count})` : ''}`
            : t('tour.noRating')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  label: {
    color: '#6B7280',
    fontWeight: '500',
  },
});
