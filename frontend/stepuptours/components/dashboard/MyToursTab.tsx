// components/dashboard/MyToursTab.tsx
// Lists tours authored by the current professional user

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getToursByAuthor } from '../../services/dashboard.service';
import type { Tour } from '../../types';

const AMBER = '#F59E0B';
const AMBER_DARK = '#D97706';

interface MyToursTabProps {
  userId: string;
}

export function MyToursTab({ userId }: MyToursTabProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTours = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getToursByAuthor(userId);
      setTours(data);
    } catch (err: any) {
      setError(err.message ?? 'Error loading tours');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadTours();
  }, [loadTours]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadTours} activeOpacity={0.8}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Create Tour button */}
      <TouchableOpacity
        style={styles.createBtn}
        activeOpacity={0.85}
        onPress={() => router.push(`/${langcode}/dashboard/create-tour` as any)}
      >
        <Ionicons name="add" size={18} color="#FFFFFF" style={styles.createBtnIcon} />
        <Text style={styles.createBtnText}>{t('dashboard.tours.create')}</Text>
      </TouchableOpacity>

      {tours.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="map-outline" size={56} color="#D1D5DB" />
          <Text style={styles.emptyText}>{t('dashboard.tours.empty')}</Text>
        </View>
      ) : (
        <View style={[styles.grid, isDesktop && styles.gridDesktop]}>
          {tours.map((tour) => (
            <TourCard
              key={tour.id}
              tour={tour}
              langcode={langcode ?? 'en'}
              onView={() => router.push(`/${langcode}/tour/${tour.drupalInternalId}` as any)}
              isDesktop={isDesktop}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Tour card ─────────────────────────────────────────────────────────────────

interface TourCardProps {
  tour: Tour;
  langcode: string;
  onView: () => void;
  isDesktop: boolean;
}

function TourCard({ tour, onView, isDesktop }: TourCardProps) {
  const { t } = useTranslation();

  return (
    <View style={[styles.card, isDesktop && styles.cardDesktop]}>
      {/* Title + status */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {tour.title}
        </Text>
        <View style={[styles.statusPill, tour.published ? styles.statusPublished : styles.statusDraft]}>
          <Text style={[styles.statusText, tour.published ? styles.statusTextPublished : styles.statusTextDraft]}>
            {tour.published ? t('dashboard.tours.published') : t('dashboard.tours.draft')}
          </Text>
        </View>
      </View>

      {/* Meta */}
      <View style={styles.cardMeta}>
        {tour.city ? (
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={14} color="#6B7280" />
            <Text style={styles.metaText}>{tour.city.name}</Text>
          </View>
        ) : null}
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color="#6B7280" />
          <Text style={styles.metaText}>{tour.duration} min</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtnOutline} onPress={onView} activeOpacity={0.8}>
          <Text style={styles.actionBtnOutlineText}>{t('dashboard.tours.view')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtnGhost} activeOpacity={0.8}>
          <Ionicons name="pencil-outline" size={14} color="#6B7280" />
          <Text style={styles.actionBtnGhostText}>{t('dashboard.tours.edit')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 48,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryBtn: {
    backgroundColor: AMBER,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },

  // Create button
  createBtn: {
    backgroundColor: AMBER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 20,
    gap: 6,
  },
  createBtnIcon: {
    marginRight: 2,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Grid
  grid: {
    gap: 12,
  },
  gridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  // Tour card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  cardDesktop: {
    flex: 1,
    minWidth: 260,
    maxWidth: '48%',
    marginBottom: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 22,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    flexShrink: 0,
  },
  statusPublished: {
    backgroundColor: '#D1FAE5',
  },
  statusDraft: {
    backgroundColor: '#F3F4F6',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statusTextPublished: {
    color: '#065F46',
  },
  statusTextDraft: {
    color: '#6B7280',
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnOutline: {
    borderWidth: 1,
    borderColor: AMBER,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  actionBtnOutlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: AMBER_DARK,
  },
  actionBtnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionBtnGhostText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
});
