// app/[langcode]/ranking.tsx
// Public ranking page — no auth required

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { getRanking } from '../../services/ranking.service';
import PageBanner from '../../components/layout/PageBanner';
import type { RankingEntry } from '../../types';

const AMBER = '#F59E0B';
const GOLD = '#F59E0B';
const SILVER = '#9CA3AF';
const BRONZE = '#B45309';

// ── Position indicator colour ────────────────────────────────────────────────
function positionColor(position: number): string {
  if (position === 1) return GOLD;
  if (position === 2) return SILVER;
  if (position === 3) return BRONZE;
  return '#6B7280';
}

// ── Avatar with fallback initials ────────────────────────────────────────────
function Avatar({ uri, name, size }: { uri: string | null; name: string; size: number }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.38, fontWeight: '700', color: AMBER }}>
        {initials || '?'}
      </Text>
    </View>
  );
}

// ── XP pill badge ────────────────────────────────────────────────────────────
function XpBadge({ xp, compact }: { xp: number; compact?: boolean }) {
  return (
    <View style={styles.xpBadge}>
      <Text style={[styles.xpBadgeText, compact ? styles.xpBadgeTextCompact : null]}>
        {xp.toLocaleString()} XP
      </Text>
    </View>
  );
}

// ── Position indicator: trophy icon for top 3, numbered circle for others ────
function PositionIndicator({
  position,
  isDesktop,
}: {
  position: number;
  isDesktop: boolean;
}) {
  const color = positionColor(position);
  const isTop3 = position <= 3;

  if (isTop3) {
    return (
      <View style={styles.positionTrophyWrap}>
        <Ionicons name="trophy" size={isDesktop ? 22 : 20} color={color} />
        <Text style={[styles.positionTrophyNumber, { color }]}>{position}</Text>
      </View>
    );
  }

  return (
    <View style={styles.positionNumberWrap}>
      <Text style={styles.positionNumber}>{position}</Text>
    </View>
  );
}

// ── Row component ────────────────────────────────────────────────────────────
function RankingRow({
  entry,
  isDesktop,
}: {
  entry: RankingEntry;
  isDesktop: boolean;
}) {
  const isTop3 = entry.position <= 3;
  const displayName = entry.publicName || entry.username;

  if (isDesktop) {
    return (
      <View style={[styles.rowCard, isTop3 && styles.rowCardTop3]}>
        {/* Position */}
        <View style={styles.positionCell}>
          <PositionIndicator position={entry.position} isDesktop={isDesktop} />
        </View>

        {/* Avatar + name */}
        <View style={styles.nameCell}>
          <Avatar uri={entry.avatar} name={displayName} size={40} />
          <Text style={styles.nameText} numberOfLines={1}>
            {displayName}
          </Text>
        </View>

        {/* Tours count */}
        <View style={styles.toursCell}>
          <Text style={styles.toursValue}>{entry.toursCompleted}</Text>
          <Text style={styles.toursLabel}>tours</Text>
        </View>

        {/* XP pill */}
        <View style={styles.xpCell}>
          <XpBadge xp={entry.totalXp} />
        </View>
      </View>
    );
  }

  // Mobile compact row
  return (
    <View style={[styles.rowCard, isTop3 && styles.rowCardTop3]}>
      {/* Position */}
      <View style={styles.positionCell}>
        <PositionIndicator position={entry.position} isDesktop={isDesktop} />
      </View>

      {/* Avatar */}
      <Avatar uri={entry.avatar} name={displayName} size={40} />

      {/* Name + tours block */}
      <View style={styles.mobileNameBlock}>
        <Text style={styles.nameText} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={styles.mobileStatsRow}>
          <Ionicons name="map-outline" size={12} color="#6B7280" />
          <Text style={styles.mobileToursText}>{entry.toursCompleted} tours</Text>
        </View>
      </View>

      {/* XP pill */}
      <XpBadge xp={entry.totalXp} compact />
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function RankingScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 768;

  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getRanking()
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message ?? 'Error loading ranking');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Header (managed by another agent — PageBanner) ──────────────────────────
  const Header = () => (
    <PageBanner
      icon="trophy"
      iconBgColor="#F59E0B"
      title={t('ranking.title')}
      subtitle={t('ranking.subtitle')}
    />
  );

  // ── Section title card ───────────────────────────────────────────────────────
  const SectionTitle = () => (
    <View style={styles.sectionTitleCard}>
      <Ionicons name="star" size={20} color={AMBER} />
      <Text style={styles.sectionTitleText}>Top Exploradores</Text>
    </View>
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.root}>
        <Header />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AMBER} />
        </View>
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={styles.root}>
        <Header />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <Header />

      <FlatList
        data={entries}
        keyExtractor={(item) => String(item.userId || item.position)}
        contentContainerStyle={[
          styles.listContent,
          entries.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={[styles.containerCard, styles.sectionTitleCardWrap]}>
            <SectionTitle />
          </View>
        }
        renderItem={({ item }) => (
          <RankingRow entry={item} isDesktop={isDesktop} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={56} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>{t('ranking.empty')}</Text>
          </View>
        }
      />
    </View>
  );
}

// ── Shadow helper ────────────────────────────────────────────────────────────
const cardShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  android: {
    elevation: 3,
  },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // ── Centered states ─────────────────────────────────────────────────────────
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    color: '#EF4444',
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // ── List ───────────────────────────────────────────────────────────────────
  listContent: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  listContentEmpty: {
    flex: 1,
  },

  // ── Section title container card ─────────────────────────────────────────────
  containerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    maxWidth: 900,
    alignSelf: 'center',
    width: undefined,
    ...cardShadow,
  },
  sectionTitleCardWrap: {
    marginBottom: 12,
  },
  sectionTitleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
  },
  sectionTitleText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },

  // ── Individual row card ───────────────────────────────────────────────────────
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    maxWidth: 900,
    alignSelf: 'center',
    width: undefined,
    ...cardShadow,
  },
  rowCardTop3: {
    backgroundColor: '#FFFBEB',
  },

  // ── Position indicators ──────────────────────────────────────────────────────
  positionCell: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionTrophyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  positionTrophyNumber: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 13,
  },
  positionNumberWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },

  // ── Name cell ────────────────────────────────────────────────────────────────
  nameCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 8,
    marginRight: 8,
  },
  nameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },

  // ── Tours cell (desktop) ─────────────────────────────────────────────────────
  toursCell: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    marginRight: 12,
  },
  toursValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  toursLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
  },

  // ── XP cell (desktop alignment) ──────────────────────────────────────────────
  xpCell: {
    alignItems: 'flex-end',
  },

  // ── XP pill badge ────────────────────────────────────────────────────────────
  xpBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  xpBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D97706',
  },
  xpBadgeTextCompact: {
    fontSize: 11,
  },

  // ── Mobile name block ────────────────────────────────────────────────────────
  mobileNameBlock: {
    flex: 1,
    marginLeft: 10,
    gap: 4,
  },
  mobileStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mobileToursText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
});
