// components/dashboard/DonationsTab.tsx
// Shows donations received by the guide, with total revenue summary

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getDonationsForAuthor } from '../../services/dashboard.service';
import type { Donation } from '../../types';

const AMBER = '#F59E0B';
const AMBER_DARK = '#D97706';
const GREEN = '#16A34A';

interface DonationsTabProps {
  userId: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function DonationsTab({ userId }: DonationsTabProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [donations, setDonations] = useState<Donation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDonations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDonationsForAuthor(userId);
      setDonations(result.donations);
      setTotal(result.total);
    } catch (err: any) {
      setError(err.message ?? 'Error loading donations');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadDonations();
  }, [loadDonations]);

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
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Total revenue card */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>{t('dashboard.donations.total')}</Text>
        <Text style={styles.totalAmount}>{total.toFixed(2)} €</Text>
      </View>

      {donations.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cash-outline" size={56} color="#D1D5DB" />
          <Text style={styles.emptyText}>{t('dashboard.donations.empty')}</Text>
        </View>
      ) : isDesktop ? (
        <DonationsTable donations={donations} t={t} />
      ) : (
        <DonationCards donations={donations} t={t} />
      )}
    </View>
  );
}

// ── Table layout (desktop) ────────────────────────────────────────────────────

function DonationsTable({ donations, t }: { donations: Donation[]; t: (key: string) => string }) {
  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHeaderRow]}>
        <Text style={[styles.tableCell, styles.tableHeader, styles.cellDate]}>
          {t('dashboard.donations.date')}
        </Text>
        <Text style={[styles.tableCell, styles.tableHeader, styles.cellTour]}>
          Tour
        </Text>
        <Text style={[styles.tableCell, styles.tableHeader, styles.cellDonor]}>
          {t('dashboard.donations.donor')}
        </Text>
        <Text style={[styles.tableCell, styles.tableHeader, styles.cellAmount]}>
          {t('dashboard.donations.amount')}
        </Text>
      </View>

      {donations.map((donation, index) => (
        <View
          key={donation.id}
          style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}
        >
          <Text style={[styles.tableCell, styles.cellDate]}>
            {formatDate(donation.createdAt)}
          </Text>
          <Text style={[styles.tableCell, styles.cellTour]} numberOfLines={1}>
            {donation.tourTitle || '—'}
          </Text>
          <Text style={[styles.tableCell, styles.cellDonor]} numberOfLines={1}>
            {donation.donorName || 'Anónimo'}
          </Text>
          <Text style={[styles.tableCell, styles.cellAmount, styles.amountText]}>
            {donation.amount.toFixed(2)} {donation.currency}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Card layout (mobile) ──────────────────────────────────────────────────────

function DonationCards({ donations, t }: { donations: Donation[]; t: (key: string) => string }) {
  return (
    <View style={styles.cardList}>
      {donations.map((donation) => (
        <View key={donation.id} style={styles.donationCard}>
          <View style={styles.donationCardLeft}>
            <Text style={styles.donationDate}>{formatDate(donation.createdAt)}</Text>
            <Text style={styles.donationTour} numberOfLines={1}>
              {donation.tourTitle || '—'}
            </Text>
            <Text style={styles.donationDonor}>
              {donation.donorName || 'Anónimo'}
            </Text>
          </View>
          <Text style={styles.donationAmount}>
            {donation.amount.toFixed(2)} {donation.currency}
          </Text>
        </View>
      ))}
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

  // Total card
  totalCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 6,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: AMBER_DARK,
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

  // Table
  table: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableHeaderRow: {
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  tableRowAlt: {
    backgroundColor: '#FAFAFA',
  },
  tableCell: {
    fontSize: 14,
    color: '#374151',
  },
  tableHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cellDate: { flex: 1.5 },
  cellTour: { flex: 2 },
  cellDonor: { flex: 2 },
  cellAmount: { flex: 1, textAlign: 'right' },
  amountText: {
    fontWeight: '600',
    color: GREEN,
  },

  // Mobile cards
  cardList: {
    gap: 10,
  },
  donationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  donationCardLeft: {
    flex: 1,
    gap: 3,
  },
  donationDate: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  donationTour: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  donationDonor: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  donationAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: GREEN,
    marginLeft: 12,
  },
});
