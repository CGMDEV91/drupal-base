// components/tour/BusinessCard.tsx
// Featured business card — sponsored promo design with shimmer header

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Business } from '../../types';
import { imageHeaders } from '../../lib/drupal-client';
import { stripHtmlText } from '../ui/HtmlText';

interface BusinessCardProps {
  business: Business;
}

const MAX_DESCRIPTION_LENGTH = 120;

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function BusinessCard({ business }: BusinessCardProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1400, useNativeDriver: false }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1400, useNativeDriver: false }),
      ])
    ).start();
  }, [shimmerAnim]);

  if (dismissed) return null;

  const mapsUrl = business.location
    ? `https://www.google.com/maps/search/?api=1&query=${business.location.lat},${business.location.lon}`
    : null;

  const openUrl = (url: string) => Linking.openURL(url).catch(() => {});

  const plainDescription = stripHtmlText(business.description);
  const truncated =
    plainDescription.length > MAX_DESCRIPTION_LENGTH
      ? `${plainDescription.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd()}…`
      : plainDescription;

  const shimmerBg = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#fff7ed', '#fef3c7'],
  });

  const hasSecondary = !!(business.phone || business.website);

  return (
    <View style={styles.card}>
      {/* Sponsored header with shimmer */}
      <Animated.View style={[styles.promoHeader, { backgroundColor: shimmerBg }]}>
        <View style={styles.promoTag}>
          <Ionicons name="pricetag-outline" size={10} color="#b45309" />
          <Text style={styles.promoTagText}>
            {'··· '}
            {t('business.sponsored').toUpperCase()}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setDismissed(true)}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={16} color="#9ca3af" />
        </TouchableOpacity>
      </Animated.View>

      {/* Body: logo + info */}
      <View style={styles.body}>
        {business.logo ? (
          <Image
            source={{ uri: business.logo as string, headers: imageHeaders }}
            style={styles.logo}
            contentFit="contain"
            transition={200}
          />
        ) : (
          <View style={styles.initials}>
            <Text style={styles.initialsText}>{getInitials(business.name)}</Text>
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {business.name}
          </Text>
          {business.category ? (
            <Text style={styles.category} numberOfLines={1}>
              {business.category.name}
            </Text>
          ) : null}
          {business.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {truncated}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Divider */}
      {(mapsUrl || hasSecondary) ? <View style={styles.divider} /> : null}

      {/* Actions */}
      {(mapsUrl || hasSecondary) ? (
        <View style={styles.actions}>
          {mapsUrl ? (
            <TouchableOpacity
              style={[styles.actionPrimary, !hasSecondary && { flex: 1 }]}
              onPress={() => openUrl(mapsUrl)}
              activeOpacity={0.85}
            >
              <Ionicons name="navigate-outline" size={14} color="#ffffff" />
              <Text style={styles.actionPrimaryText}>{t('business.directions')}</Text>
            </TouchableOpacity>
          ) : null}

          {hasSecondary ? (
            <View style={styles.actionsSecondary}>
              {business.phone ? (
                <TouchableOpacity
                  style={styles.actionSecondary}
                  onPress={() => openUrl(`tel:${business.phone}`)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call-outline" size={15} color="#4b5563" />
                  <Text style={styles.actionSecondaryText}>{t('business.call')}</Text>
                </TouchableOpacity>
              ) : null}
              {business.website ? (
                <TouchableOpacity
                  style={styles.actionSecondary}
                  onPress={() => openUrl(business.website!)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="globe-outline" size={15} color="#4b5563" />
                  <Text style={styles.actionSecondaryText}>{t('business.website')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#fcd9a8',
    borderRadius: 14,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  promoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  promoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  promoTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309',
    letterSpacing: 0.5,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    flexShrink: 0,
  },
  initials: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#ea580c',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  initialsText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  category: {
    fontSize: 12,
    color: '#6b7280',
  },
  description: {
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 17,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#fef3c7',
    marginHorizontal: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    paddingTop: 10,
  },
  actionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ea580c',
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  actionPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  actionsSecondary: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  actionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  actionSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
});
