// app/[langcode]/ranking.tsx
// Public ranking page — no auth required

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import CountryFlag from 'react-native-country-flag';
import { getRanking } from '../../services/ranking.service';
import PageBanner from '../../components/layout/PageBanner';
import Footer from '../../components/layout/Footer';
import type { RankingEntry } from '../../types';

const AMBER = '#F59E0B';
const SILVER = '#9CA3AF';
const BRONZE = '#CD7C2F';

const DESKTOP_MAX_WIDTH = 900;
const H_PAD_DESKTOP = 32;

// ── Position icon ─────────────────────────────────────────────────────────────
function PositionIcon({ position }: { position: number }) {
  if (position === 1) {
    return (
      <View style={styles.positionCell}>
        <Ionicons name="trophy" size={26} color={AMBER} />
      </View>
    );
  }
  if (position === 2) {
    return (
      <View style={styles.positionCell}>
        <Ionicons name="ribbon" size={24} color={SILVER} />
      </View>
    );
  }
  if (position === 3) {
    return (
      <View style={styles.positionCell}>
        <Ionicons name="ribbon" size={24} color={BRONZE} />
      </View>
    );
  }
  return (
    <View style={styles.positionCell}>
      <View style={styles.positionNumberWrap}>
        <Text style={styles.positionNumber}>{position}</Text>
      </View>
    </View>
  );
}

// ── Avatar with country flag or globe fallback ────────────────────────────────
function Avatar({
  uri,
  countryCode,
  size,
}: {
  uri: string | null;
  countryCode: string | null;
  size: number;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }

  if (countryCode) {
    return <CountryFlag isoCode={countryCode} size={16} />;
  }

  // Fallback: globe icon
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="earth" size={size * 0.62} color="#9CA3AF" />
    </View>
  );
}

// ── XP badge ──────────────────────────────────────────────────────────────────
function XpBadge({ xp }: { xp: number }) {
  return (
    <View style={styles.xpBadge}>
      <Text style={styles.xpBadgeText}>{xp.toLocaleString()} XP</Text>
    </View>
  );
}

// ── Row colors by position ────────────────────────────────────────────────────
function rowBgStyle(position: number) {
  if (position === 1) return { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' };
  if (position === 2) return { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' };
  if (position === 3) return { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' };
  return { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' };
}

// ── Single ranking row ────────────────────────────────────────────────────────
function RankingRow({ entry, isLast }: { entry: RankingEntry; isLast: boolean }) {
  const displayName = entry.publicName || entry.username;

  return (
    <View
      style={[
        styles.rowCard,
        rowBgStyle(entry.position),
        isLast && styles.rowCardLast,
      ]}
    >
      <PositionIcon position={entry.position} />
      <Avatar uri={entry.avatar} countryCode={entry.countryCode} size={40} />
      <Text style={styles.nameText} numberOfLines={1}>
        {displayName}
      </Text>
      <View style={styles.toursBlock}>
        <Text style={styles.toursValue}>{entry.toursCompleted}</Text>
        <Text style={styles.toursLabel}>tours</Text>
      </View>
      <XpBadge xp={entry.totalXp} />
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
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
      .then((data) => { if (!cancelled) setEntries(data); })
      .catch((err: any) => { if (!cancelled) setError(err.message ?? 'Error loading ranking'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const cardStyle = isDesktop
    ? {
        maxWidth: DESKTOP_MAX_WIDTH,
        alignSelf: 'center' as const,
        width: width - H_PAD_DESKTOP * 2,
        marginHorizontal: H_PAD_DESKTOP,
      }
    : { marginHorizontal: 16 };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AMBER} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    if (entries.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="trophy-outline" size={56} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>{t('ranking.empty')}</Text>
        </View>
      );
    }

    return entries.map((entry, index) => (
      <RankingRow
        key={String(entry.userId || entry.position)}
        entry={entry}
        isLast={index === entries.length - 1}
      />
    ));
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
      bounces={false}
      overScrollMode="never"
    >
      <PageBanner
        icon="trophy"
        iconBgColor={AMBER}
        title={t('ranking.title')}
        subtitle={t('ranking.subtitle')}
        showBack={false}
      />

      {/* Main card: section title + all rows */}
      <View style={[styles.mainCard, cardStyle]}>
        {/* Section title */}
        <View style={styles.sectionTitleRow}>
          <Ionicons name="star" size={18} color={AMBER} />
          <Text style={styles.sectionTitleText}>Top Exploradores</Text>
        </View>

        {/* Rows */}
        {renderContent()}
      </View>
      <Footer />
    </ScrollView>
  );
}

const cardShadow = Platform.select({
  web: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' } as any,
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: { elevation: 3 },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    ...(Platform.OS === 'web' ? { height: '100vh' as any, overflow: 'hidden' as any } : {}),
  },
  scrollContent: {
    paddingBottom: 0,
  },

  // ── Centered / error / empty ──────────────────────────────────────────────────
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 48,
  },
  errorText: {
    fontSize: 15,
    color: '#EF4444',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },

  // ── Main card (outer container) ───────────────────────────────────────────────
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 30,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    ...cardShadow,
  },

  // ── Section title ─────────────────────────────────────────────────────────────
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 12,
  },
  sectionTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  // ── Ranking row sub-card ──────────────────────────────────────────────────────
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  rowCardLast: {
    marginBottom: 0,
  },

  // ── Position indicators ───────────────────────────────────────────────────────
  positionCell: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
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

  // ── Name ─────────────────────────────────────────────────────────────────────
  nameText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },

  // ── Tours block ───────────────────────────────────────────────────────────────
  toursBlock: {
    alignItems: 'center',
    minWidth: 44,
  },
  toursValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    lineHeight: 18,
  },
  toursLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
    lineHeight: 14,
  },

  // ── XP badge ──────────────────────────────────────────────────────────────────
  xpBadge: {
    backgroundColor: AMBER,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  xpBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
