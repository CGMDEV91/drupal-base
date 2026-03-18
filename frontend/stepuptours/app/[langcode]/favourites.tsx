// app/[langcode]/favourites.tsx
// Favourite tours page — auth-protected

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/auth.store';
import { getUserTourActivities, upsertTourActivity, getTourById } from '../../services/tours.service';
import { TourCard } from '../../components/tour/TourCard';
import type { Tour, TourActivity } from '../../types';

const AMBER = '#F59E0B';

interface FavouriteItem {
  activity: TourActivity;
  tour: Tour;
}

export default function FavouritesScreen() {
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  const user = useAuthStore((s) => s.user);

  const [items, setItems] = useState<FavouriteItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const cols = isDesktop ? 4 : isTablet ? 3 : 2;
  const PADDING = isDesktop ? 32 : 16;
  const GAP = 12;
  const cardWidth = (width - PADDING * 2 - GAP * (cols - 1)) / cols;

  const fetchFavourites = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const activities = await getUserTourActivities(user.id);
      const favouriteActivities = activities.filter((a) => a.isFavorite);
      const resolved = await Promise.allSettled(
        favouriteActivities.map(async (activity) => {
          const tour = await getTourById(activity.tourId);
          return { activity, tour } as FavouriteItem;
        })
      );
      const successful = resolved
        .filter((r): r is PromiseFulfilledResult<FavouriteItem> => r.status === 'fulfilled')
        .map((r) => r.value);
      setItems(successful);
    } catch (err: any) {
      setError(err.message ?? 'Error loading favourites');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFavourites();
  }, [fetchFavourites]);

  const handleToggleFavourite = useCallback(
    async (activity: TourActivity) => {
      if (!user) return;
      try {
        await upsertTourActivity(user.id, activity.tourId, { isFavorite: false });
        setItems((prev) => prev.filter((item) => item.activity.tourId !== activity.tourId));
      } catch {
        // Silently ignore toggle errors
      }
    },
    [user]
  );

  // ── Not authenticated ──────────────────────────────────────────────────────
  if (!user) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('nav.favourites')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.authGate}>
          <Ionicons name="heart-outline" size={56} color="#D1D5DB" />
          <Text style={styles.authGateTitle}>Sign in to see your favourites</Text>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.replace(`/${langcode}` as any)}
          >
            <Text style={styles.btnPrimaryText}>{t('nav.signin')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('nav.favourites')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AMBER} />
        </View>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Amber header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('nav.favourites')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.activity.tourId}
        numColumns={cols}
        key={`fav-grid-${cols}`}
        columnWrapperStyle={cols > 1 ? { gap: GAP, paddingHorizontal: PADDING } : undefined}
        contentContainerStyle={[
          styles.listContent,
          items.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TourCard
            tour={item.tour}
            cardWidth={cardWidth}
            langcode={langcode}
            isFavorite={true}
            onToggleFavorite={() => handleToggleFavourite(item.activity)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={56} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No favourites yet</Text>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => router.replace(`/${langcode}` as any)}
            >
              <Text style={styles.btnPrimaryText}>{t('home.allCountries')}</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // ── Amber header ────────────────────────────────────────────────────────────
  header: {
    height: 56,
    backgroundColor: AMBER,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  backBtn: {
    padding: 6,
    borderRadius: 20,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 34, // mirrors backBtn width to centre the title
  },

  // ── Auth gate & centered states ────────────────────────────────────────────
  authGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  authGateTitle: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── List ───────────────────────────────────────────────────────────────────
  listContent: {
    paddingTop: 16,
    paddingBottom: 40,
  },
  listContentEmpty: {
    flex: 1,
  },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },

  // ── Button ────────────────────────────────────────────────────────────────
  btnPrimary: {
    backgroundColor: AMBER,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
