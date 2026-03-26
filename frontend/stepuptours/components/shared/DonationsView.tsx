// components/shared/DonationsView.tsx
// Shared donations UI — used by admin (all donations) and professional (own donations)

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getDonationsForAuthor } from '../../services/dashboard.service';
import {
  getAdminDonations,
  getAdminDonationsSummary,
  type AdminDonation,
  type DonationsSummary,
} from '../../services/payment.service';
import type { Donation } from '../../types';

const AMBER = '#F59E0B';
const AMBER_DARK = '#D97706';
const GREEN = '#16A34A';
const NAVY = '#1E293B';

interface DonationsViewProps {
  mode: 'admin' | 'professional';
  userId?: string; // required for professional mode
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatCurrency(amount: number, currency?: string): string {
  return `${amount.toFixed(2)} ${currency ?? '€'}`;
}

// Unified row type for both modes
interface DonationRow {
  id: string;
  createdAt: string;
  tourTitle: string;
  donorName: string;
  amount: number;
  currency: string;
  // Admin-only fields
  tourOwnerName?: string;
  tourOwnerIsAdmin?: boolean;
  guideRevenue?: number;
  platformRevenue?: number;
}

export function DonationsView({ mode, userId }: DonationsViewProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [rows, setRows] = useState<DonationRow[]>([]);
  const [summary, setSummary] = useState<DonationsSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'admin') {
        const [donations, sum] = await Promise.all([
          getAdminDonations(),
          getAdminDonationsSummary(),
        ]);
        setRows(
          donations.map((d) => ({
            id: d.id,
            createdAt: d.createdAt,
            tourTitle: d.tourTitle,
            donorName: d.donorName,
            amount: d.amount,
            currency: d.currency,
            tourOwnerName: d.tourOwnerName,
            tourOwnerIsAdmin: d.tourOwnerIsAdmin,
            guideRevenue: d.guideRevenue,
            platformRevenue: d.platformRevenue,
          })),
        );
        setSummary(sum);
      } else {
        if (!userId) return;
        const result = await getDonationsForAuthor(userId);
        setRows(
          result.donations.map((d) => ({
            id: d.id,
            createdAt: d.createdAt,
            tourTitle: d.tourTitle,
            donorName: d.donorName,
            amount: d.amount,
            currency: d.currency,
          })),
        );
        setTotal(result.total);
      }
    } catch (err: any) {
      setError(err.message ?? 'Error loading donations');
    } finally {
      setLoading(false);
    }
  }, [mode, userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      {/* Summary cards */}
      {mode === 'admin' && summary ? (
        <AdminSummaryCards summary={summary} t={t} />
      ) : (
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{t('dashboard.donations.total')}</Text>
          <Text style={styles.totalAmount}>{total.toFixed(2)} €</Text>
        </View>
      )}

      {rows.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cash-outline" size={56} color="#D1D5DB" />
          <Text style={styles.emptyText}>{t('dashboard.donations.empty')}</Text>
        </View>
      ) : isDesktop ? (
        <DonationsTable rows={rows} mode={mode} t={t} />
      ) : (
        <DonationCards rows={rows} mode={mode} t={t} />
      )}
    </View>
  );
}

// ── Admin summary cards ────────────────────────────────────────────────────────

function AdminSummaryCards({
  summary,
  t,
}: {
  summary: DonationsSummary;
  t: (key: string) => string;
}) {
  return (
    <View style={styles.summaryGrid}>
      <View style={[styles.summaryCard, { backgroundColor: '#FEF3C7' }]}>
        <Ionicons name="cash-outline" size={22} color={AMBER_DARK} />
        <Text style={[styles.summaryValue, { color: AMBER_DARK }]}>
          {summary.totalAmount.toFixed(2)} €
        </Text>
        <Text style={styles.summaryLabel}>{t('admin.donations.totalAmount')}</Text>
      </View>
      <View style={[styles.summaryCard, { backgroundColor: '#ECFDF5' }]}>
        <Ionicons name="business-outline" size={22} color="#059669" />
        <Text style={[styles.summaryValue, { color: '#059669' }]}>
          {summary.totalPlatformRevenue.toFixed(2)} €
        </Text>
        <Text style={styles.summaryLabel}>{t('admin.donations.platformRevenue')}</Text>
      </View>
      <View style={[styles.summaryCard, { backgroundColor: '#EFF6FF' }]}>
        <Ionicons name="person-outline" size={22} color="#2563EB" />
        <Text style={[styles.summaryValue, { color: '#2563EB' }]}>
          {summary.totalGuideRevenue.toFixed(2)} €
        </Text>
        <Text style={styles.summaryLabel}>{t('admin.donations.guideRevenue')}</Text>
      </View>
      <View style={[styles.summaryCard, { backgroundColor: '#F3F4F6' }]}>
        <Ionicons name="receipt-outline" size={22} color="#4B5563" />
        <Text style={[styles.summaryValue, { color: '#4B5563' }]}>
          {summary.donationsCount}
        </Text>
        <Text style={styles.summaryLabel}>{t('admin.donations.count')}</Text>
      </View>
    </View>
  );
}

// ── Table layout (desktop) ──────────────────────────────────────────────────────

function DonationsTable({
  rows,
  mode,
  t,
}: {
  rows: DonationRow[];
  mode: 'admin' | 'professional';
  t: (key: string) => string;
}) {
  const isAdmin = mode === 'admin';

  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHeaderRow]}>
        <Text style={[styles.tableCell, styles.tableHeader, styles.cellDate]}>
          {t('dashboard.donations.date')}
        </Text>
        <Text style={[styles.tableCell, styles.tableHeader, styles.cellTour]}>
          Tour
        </Text>
        {isAdmin && (
          <Text style={[styles.tableCell, styles.tableHeader, styles.cellOwner]}>
            {t('admin.donations.owner')}
          </Text>
        )}
        <Text style={[styles.tableCell, styles.tableHeader, styles.cellDonor]}>
          {t('dashboard.donations.donor')}
        </Text>
        <Text style={[styles.tableCell, styles.tableHeader, styles.cellAmount]}>
          {t('dashboard.donations.amount')}
        </Text>
        {isAdmin && (
          <>
            <Text style={[styles.tableCell, styles.tableHeader, styles.cellRevenue]}>
              {t('donation.split.platform')}
            </Text>
            <Text style={[styles.tableCell, styles.tableHeader, styles.cellRevenue]}>
              {t('donation.split.guide')}
            </Text>
          </>
        )}
      </View>

      {rows.map((row, index) => (
        <View
          key={row.id}
          style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}
        >
          <Text style={[styles.tableCell, styles.cellDate]}>
            {formatDate(row.createdAt)}
          </Text>
          <Text style={[styles.tableCell, styles.cellTour]} numberOfLines={1}>
            {row.tourTitle || '—'}
          </Text>
          {isAdmin && (
            <View style={[styles.cellOwner, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
              <Text style={styles.tableCell} numberOfLines={1}>
                {row.tourOwnerName || '—'}
              </Text>
              {row.tourOwnerIsAdmin && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>Admin</Text>
                </View>
              )}
              {!row.tourOwnerIsAdmin && row.tourOwnerName && (
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>Pro</Text>
                </View>
              )}
            </View>
          )}
          <Text style={[styles.tableCell, styles.cellDonor]} numberOfLines={1}>
            {row.donorName || 'Anónimo'}
          </Text>
          <Text style={[styles.tableCell, styles.cellAmount, styles.amountText]}>
            {formatCurrency(row.amount, row.currency)}
          </Text>
          {isAdmin && (
            <>
              <Text style={[styles.tableCell, styles.cellRevenue, { color: '#059669', fontWeight: '600' }]}>
                {formatCurrency(row.platformRevenue ?? 0)}
              </Text>
              <Text style={[styles.tableCell, styles.cellRevenue, { color: '#2563EB', fontWeight: '600' }]}>
                {formatCurrency(row.guideRevenue ?? 0)}
              </Text>
            </>
          )}
        </View>
      ))}
    </View>
  );
}

// ── Card layout (mobile) ────────────────────────────────────────────────────────

function DonationCards({
  rows,
  mode,
  t,
}: {
  rows: DonationRow[];
  mode: 'admin' | 'professional';
  t: (key: string) => string;
}) {
  const isAdmin = mode === 'admin';

  return (
    <View style={styles.cardList}>
      {rows.map((row) => (
        <View key={row.id} style={styles.donationCard}>
          <View style={styles.donationCardLeft}>
            <Text style={styles.donationDate}>{formatDate(row.createdAt)}</Text>
            <Text style={styles.donationTour} numberOfLines={1}>
              {row.tourTitle || '—'}
            </Text>
            <Text style={styles.donationDonor}>
              {row.donorName || 'Anónimo'}
            </Text>
            {isAdmin && row.tourOwnerName && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Text style={styles.ownerLabel}>{row.tourOwnerName}</Text>
                {row.tourOwnerIsAdmin ? (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                ) : (
                  <View style={styles.proBadge}>
                    <Text style={styles.proBadgeText}>Pro</Text>
                  </View>
                )}
              </View>
            )}
          </View>
          <View style={styles.donationCardRight}>
            <Text style={styles.donationAmount}>
              {formatCurrency(row.amount, row.currency)}
            </Text>
            {isAdmin && (
              <View style={styles.splitMini}>
                <Text style={styles.splitMiniPlatform}>
                  P: {(row.platformRevenue ?? 0).toFixed(2)}
                </Text>
                <Text style={styles.splitMiniGuide}>
                  G: {(row.guideRevenue ?? 0).toFixed(2)}
                </Text>
              </View>
            )}
          </View>
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

  // Summary grid (admin)
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    minWidth: 140,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  // Total card (professional)
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
    marginBottom: 30,
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
  cellDate: { flex: 1.2 },
  cellTour: { flex: 2 },
  cellOwner: { flex: 1.5 },
  cellDonor: { flex: 1.5 },
  cellAmount: { flex: 1, textAlign: 'right' },
  cellRevenue: { flex: 0.8, textAlign: 'right' },
  amountText: {
    fontWeight: '600',
    color: GREEN,
  },

  // Badges
  adminBadge: {
    backgroundColor: NAVY,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  proBadge: {
    backgroundColor: AMBER,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
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
    marginBottom: 30,
  },
  donationCardLeft: {
    flex: 1,
    gap: 3,
  },
  donationCardRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
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
  ownerLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  donationAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: GREEN,
  },
  splitMini: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  splitMiniPlatform: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
  },
  splitMiniGuide: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563EB',
  },
});
