// components/tour/StarRating.tsx
// Reusable star rating component — display and interactive modes

import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const AMBER = '#F59E0B';
const STAR_EMPTY = '#D1D5DB';
const COUNT_GRAY = '#9CA3AF';

interface StarRatingProps {
  /** Current rating value 0-5. Accepts both `value` (preferred) for clarity. */
  value?: number;
  /** @deprecated use value instead */
  rating?: number;
  /** Number of reviews (shown in display mode) */
  count?: number;
  /** @deprecated use count instead */
  ratingCount?: number;
  interactive?: boolean;
  onRate?: (rating: number) => void;
  size?: number;
}

export function StarRating({
  value,
  rating,
  count,
  ratingCount,
  interactive = false,
  onRate,
  size = 14,
}: StarRatingProps) {
  const { t } = useTranslation();

  // Support both `value` and legacy `rating` prop
  const ratingValue = value ?? rating ?? 0;
  const reviewCount = count ?? ratingCount;

  // One Animated.Value per star for bounce effect
  const starAnims = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(1))
  ).current;

  // When rating changes externally (display mode), ensure no stale anims
  useEffect(() => {
    // nothing needed for display mode
  }, [ratingValue]);

  const handleStarPress = (starIndex: number) => {
    if (!interactive || !onRate) return;

    // Cascade bounce: animate each star 0..starIndex with 30ms stagger
    for (let i = 0; i <= starIndex; i++) {
      const delay = i * 30;
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(starAnims[i], {
          toValue: 1.5,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(starAnims[i], {
          toValue: 1,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }

    onRate(starIndex + 1);
  };

  const stars = Array.from({ length: 5 }, (_, i) => {
    const starIndex = i;
    const filled = i + 1 <= Math.round(ratingValue);
    const iconName: any = filled ? 'star' : 'star-outline';
    const color = filled ? AMBER : STAR_EMPTY;

    if (interactive) {
      return (
        <TouchableOpacity
          key={starIndex}
          onPress={() => handleStarPress(starIndex)}
          hitSlop={6}
          activeOpacity={0.7}
        >
          <Animated.View style={{ transform: [{ scale: starAnims[i] }] }}>
            <Ionicons name={iconName} size={size} color={color} />
          </Animated.View>
        </TouchableOpacity>
      );
    }

    return <Ionicons key={starIndex} name={iconName} size={size} color={color} />;
  });

  const hasRating = ratingValue > 0;

  return (
    <View style={styles.container}>
      <View style={styles.starsRow}>{stars}</View>
      {!interactive && (
        <>
          {hasRating && (
            <Text style={[styles.ratingValue, { fontSize: size - 1 }]}>
              {ratingValue.toFixed(1)}
            </Text>
          )}
          {reviewCount !== undefined && (
            <Text style={[styles.ratingCount, { fontSize: size - 2 }]}>
              ({reviewCount})
            </Text>
          )}
          {!hasRating && reviewCount === undefined && (
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
