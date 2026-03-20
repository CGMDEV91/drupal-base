// components/dashboard/SubscriptionTab.tsx
// Shows the current subscription status and plan details

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getActiveSubscription, updateSubscription } from '../../services/dashboard.service';
import type { Subscription } from '../../types';

const AMBER = '#F59E0B';
const AMBER_DARK = '#D97706';

interface SubscriptionTabProps {
  userId: string;
}

export function SubscriptionTab({ userId }: SubscriptionTabProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingRenewal, setUpdatingRenewal] = useState(false);

  const loadSubscription = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getActiveSubscription(userId);
      setSubscription(data);
    } catch (err: any) {
      setError(err.message ?? 'Error loading subscription');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const handleAutoRenewalToggle = useCallback(
    async (value: boolean) => {
      if (!subscription) return;
      setUpdatingRenewal(true);
      try {
        await updateSubscription(subscription.id, value);
        setSubscription((prev) => (prev ? { ...prev, autoRenewal: value } : prev));
      } catch {
        // Revert on failure — no-op; current state kept
      } finally {
        setUpdatingRenewal(false);
      }
    },
    [subscription]
  );

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

  if (!subscription) {
    return (
      <View style={styles.centered}>
        <Ionicons name="card-outline" size={56} color="#D1D5DB" />
        <Text style={styles.emptyText}>{t('dashboard.subscription.none')}</Text>
      </View>
    );
  }

  const plan = subscription.plan;
  const startDate = subscription.startDate
    ? new Date(subscription.startDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';
  const endDate = subscription.endDate
    ? new Date(subscription.endDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  const maxBusinessLabel =
    plan.maxFeaturedSteps === -1
      ? t('dashboard.subscription.unlimited')
      : String(plan.maxFeaturedSteps);

  const maxLangLabel =
    plan.maxLanguages === -1
      ? t('dashboard.subscription.unlimited')
      : String(plan.maxLanguages);

  return (
    <View style={styles.container}>
      {/* Plan header card */}
      <View style={[styles.planBadge, plan.planType === 'premium' && styles.planBadgePremium]}>
        <Text style={styles.planBadgeTitle}>{plan.title}</Text>
        <Text style={styles.planBadgeType}>{plan.planType.toUpperCase()}</Text>
      </View>

      {/* Details */}
      <View style={[styles.detailsGrid, isDesktop && styles.detailsGridDesktop]}>
        <InfoRow label={t('dashboard.subscription.cycle')} value={plan.billingCycle} />
        <InfoRow
          label={t('dashboard.subscription.price')}
          value={plan.price === 0 ? t('subscription.free') : `${plan.price} €`}
        />
        <InfoRow label={t('dashboard.subscription.starts')} value={startDate} />
        <InfoRow label={t('dashboard.subscription.ends')} value={endDate} />
      </View>

      {/* Auto-renewal toggle */}
      <View style={styles.renewalRow}>
        <View style={styles.renewalInfo}>
          <Text style={styles.renewalLabel}>{t('dashboard.subscription.autoRenewal')}</Text>
        </View>
        {updatingRenewal ? (
          <ActivityIndicator size="small" color={AMBER} />
        ) : (
          <Switch
            value={subscription.autoRenewal}
            onValueChange={handleAutoRenewalToggle}
            trackColor={{ false: '#E5E7EB', true: AMBER }}
            thumbColor="#FFFFFF"
          />
        )}
      </View>

      {/* Plan limits */}
      <View style={styles.limitsSection}>
        <Text style={styles.limitsSectionTitle}>{t('dashboard.subscription.limits')}</Text>
        <View style={styles.limitsGrid}>
          <LimitCard
            icon="business-outline"
            label={t('dashboard.subscription.maxBusiness')}
            value={maxBusinessLabel}
          />
          <LimitCard
            icon="language-outline"
            label={t('dashboard.subscription.maxLanguages')}
            value={maxLangLabel}
          />
        </View>
      </View>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function LimitCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.limitCard}>
      <Ionicons name={icon as any} size={22} color={AMBER_DARK} />
      <Text style={styles.limitValue}>{value}</Text>
      <Text style={styles.limitLabel}>{label}</Text>
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
  emptyText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Plan badge
  planBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  planBadgePremium: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  planBadgeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  planBadgeType: {
    fontSize: 12,
    fontWeight: '700',
    color: AMBER_DARK,
    letterSpacing: 1,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  // Details grid
  detailsGrid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    overflow: 'hidden',
  },
  detailsGridDesktop: {},
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  // Auto-renewal
  renewalRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  renewalInfo: {
    flex: 1,
  },
  renewalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },

  // Limits
  limitsSection: {
    marginBottom: 8,
  },
  limitsSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  limitsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  limitCard: {
    flex: 1,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  limitValue: {
    fontSize: 20,
    fontWeight: '800',
    color: AMBER_DARK,
  },
  limitLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
});
