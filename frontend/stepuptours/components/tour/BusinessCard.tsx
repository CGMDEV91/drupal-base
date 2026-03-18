// components/tour/BusinessCard.tsx
// Google My Business style card for featured businesses in tour steps

import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Business } from '../../types';

interface BusinessCardProps {
  business: Business;
}

const MAX_DESCRIPTION_LENGTH = 120;

export function BusinessCard({ business }: BusinessCardProps) {
  const { t } = useTranslation();

  const truncatedDescription =
    business.description.length > MAX_DESCRIPTION_LENGTH
      ? `${business.description.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd()}...`
      : business.description;

  const mapsUrl =
    business.location
      ? `https://www.google.com/maps/search/?api=1&query=${business.location.lat},${business.location.lon}`
      : null;

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {business.logo ? (
          <Image
            source={business.logo}
            style={styles.logo}
            contentFit="contain"
            transition={200}
          />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Ionicons name="business-outline" size={24} color="#9CA3AF" />
          </View>
        )}

        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {business.name}
          </Text>
          {business.category ? (
            <Text style={styles.category} numberOfLines={1}>
              {business.category.name}
            </Text>
          ) : null}
        </View>
      </View>

      {business.description ? (
        <Text style={styles.description}>{truncatedDescription}</Text>
      ) : null}

      <View style={styles.actions}>
        {mapsUrl ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openUrl(mapsUrl)}
            activeOpacity={0.7}
          >
            <Ionicons name="navigate-outline" size={16} color="#3B82F6" />
            <Text style={styles.actionText}>{t('business.directions')}</Text>
          </TouchableOpacity>
        ) : null}

        {business.phone ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openUrl(`tel:${business.phone}`)}
            activeOpacity={0.7}
          >
            <Ionicons name="call-outline" size={16} color="#3B82F6" />
            <Text style={styles.actionText}>{business.phone}</Text>
          </TouchableOpacity>
        ) : null}

        {business.website ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openUrl(business.website!)}
            activeOpacity={0.7}
          >
            <Ionicons name="globe-outline" size={16} color="#3B82F6" />
            <Text style={styles.actionText} numberOfLines={1}>
              {business.website.replace(/^https?:\/\/(www\.)?/, '')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  category: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  description: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '500',
    maxWidth: 160,
  },
});
