// components/dashboard/SubscriptionTab.tsx
// Subscription management: active plan details or plan selection + Stripe checkout

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getActiveSubscription, getSubscriptionPlans, updateSubscription } from '../../services/dashboard.service';
import { createSubscriptionIntent, activateSubscription } from '../../services/subscription.service';
import { getStripePromise } from '../../lib/stripe';
import type { Subscription, SubscriptionPlan } from '../../types';

const AMBER = '#F59E0B';
const AMBER_DARK = '#D97706';

interface SubscriptionTabProps {
  userId: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// ── Main tab ─────────────────────────────────────────────────────────────────

export function SubscriptionTab({ userId }: SubscriptionTabProps) {
  const { t } = useTranslation();

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
        // revert on failure — no-op, state unchanged
      } finally {
        setUpdatingRenewal(false);
      }
    },
    [subscription],
  );

  const handleCancelSubscription = useCallback(() => {
    if (!subscription) return;
    Alert.alert(
      t('subscription.cancelTitle'),
      t('subscription.cancelConfirm', { date: formatDate(subscription.endDate) }),
      [
        { text: t('subscription.cancelBack'), style: 'cancel' },
        {
          text: t('subscription.cancelConfirmBtn'),
          style: 'destructive',
          onPress: async () => {
            try {
              await updateSubscription(subscription.id, false);
              setSubscription((prev) => (prev ? { ...prev, autoRenewal: false } : prev));
            } catch {
              Alert.alert(t('subscription.errorTitle'), t('subscription.cancelError'));
            }
          },
        },
      ],
    );
  }, [subscription, t]);

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
    return <NoSubscriptionView onSubscribed={loadSubscription} />;
  }

  // ── Active subscription ───────────────────────────────────────────────────

  const plan = subscription.plan;
  const maxBusinessLabel = plan.maxFeaturedDetail === -1 ? t('dashboard.subscription.unlimited') : String(plan.maxFeaturedDetail);
  const maxStepsLabel    = plan.maxFeaturedSteps === -1   ? t('dashboard.subscription.unlimited') : String(plan.maxFeaturedSteps);
  const maxLangLabel     = plan.maxLanguages === -1       ? t('dashboard.subscription.unlimited') : String(plan.maxLanguages);

  return (
    <View style={styles.container}>
      {/* Plan header */}
      <View style={[styles.planCard, plan.planType === 'premium' && styles.planCardPremium]}>
        <View style={styles.planCardHeader}>
          <Text style={styles.planName}>{plan.title}</Text>
          <View style={styles.planTypeBadge}>
            <Text style={styles.planTypeBadgeText}>{plan.planType.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.planPrice}>
          {plan.price === 0
            ? t('subscription.free')
            : `${plan.price} € / ${plan.billingCycle === 'monthly' ? t('subscription.monthly').toLowerCase() : t('subscription.annual').toLowerCase()}`}
        </Text>
      </View>

      {/* Details */}
      <View style={styles.section}>
        <InfoRow label={t('dashboard.subscription.cycle')} value={plan.billingCycle === 'monthly' ? t('subscription.monthly') : plan.billingCycle === 'annual' ? t('subscription.annual') : '—'} />
        <InfoRow label={t('dashboard.subscription.starts')} value={formatDate(subscription.startDate)} />
        <InfoRow label={t('dashboard.subscription.ends')} value={formatDate(subscription.endDate)} />
        <InfoRow label={t('dashboard.subscription.type')} value={subscription.status === 'active' ? t('subscription.statusActive') : subscription.status} />
      </View>

      {/* Auto-renewal */}
      <View style={styles.renewalRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.renewalLabel}>{t('dashboard.subscription.autoRenewal')}</Text>
          <Text style={styles.renewalSub}>
            {subscription.autoRenewal
              ? t('subscription.renewsOn', { date: formatDate(subscription.endDate) })
              : t('subscription.expiresOn', { date: formatDate(subscription.endDate) })}
          </Text>
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

      {subscription.autoRenewal && (
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelSubscription}>
          <Text style={styles.cancelBtnText}>{t('subscription.cancel')}</Text>
        </TouchableOpacity>
      )}

      {/* Plan limits */}
      <Text style={styles.sectionTitle}>{t('dashboard.subscription.limits')}</Text>
      <View style={styles.limitsGrid}>
        <LimitCard icon="business-outline" label={t('dashboard.subscription.maxBusiness')} value={maxBusinessLabel} />
        <LimitCard icon="location-outline" label={t('subscription.maxSteps')} value={maxStepsLabel} />
        <LimitCard icon="language-outline" label={t('dashboard.subscription.maxLanguages')} value={maxLangLabel} />
      </View>

      {/* Last payment */}
      <Text style={styles.sectionTitle}>{t('subscription.lastPayment')}</Text>
      <View style={styles.section}>
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          <Text style={[styles.tableCell, styles.tableHeader, { flex: 1.5 }]}>{t('dashboard.donations.date')}</Text>
          <Text style={[styles.tableCell, styles.tableHeader, { flex: 2 }]}>{t('subscription.plan')}</Text>
          <Text style={[styles.tableCell, styles.tableHeader, { flex: 1, textAlign: 'right' }]}>{t('subscription.amount')}</Text>
        </View>
        {subscription.lastPaymentAt ? (
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>{formatDateShort(subscription.lastPaymentAt)}</Text>
            <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{plan.title}</Text>
            <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', color: '#16A34A', fontWeight: '600' }]}>
              {plan.price.toFixed(2)} €
            </Text>
          </View>
        ) : (
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { color: '#9CA3AF' }]}>{t('subscription.noPayments')}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── No subscription view ──────────────────────────────────────────────────────

interface NoSubscriptionViewProps {
  onSubscribed: () => void;
}

function NoSubscriptionView({ onSubscribed }: NoSubscriptionViewProps) {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [autoRenewal, setAutoRenewal] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);

  useEffect(() => {
    getSubscriptionPlans()
      .then((data) => {
        setPlans(data);
        const match = data.find((p) => p.billingCycle === billingCycle);
        if (match) setSelectedPlan(match);
      })
      .catch(() => {})
      .finally(() => setLoadingPlans(false));
  }, []);

  // When cycle changes, find matching plan
  useEffect(() => {
    if (plans.length === 0) return;
    const match = plans.find((p) => p.billingCycle === billingCycle);
    if (match) setSelectedPlan(match);
  }, [billingCycle, plans]);

  const annualPlan   = plans.find((p) => p.billingCycle === 'annual');
  const monthlyPlan  = plans.find((p) => p.billingCycle === 'monthly');
  const annualSaving = monthlyPlan && annualPlan
    ? Math.round((1 - annualPlan.price / (monthlyPlan.price * 12)) * 100)
    : 20;

  if (subscribeSuccess) {
    return (
      <View style={styles.container}>
        <View style={styles.successView}>
          <Ionicons name="checkmark-circle" size={64} color="#16A34A" />
          <Text style={styles.successTitle}>{t('subscription.successTitle')}</Text>
          <Text style={styles.successSub}>{t('subscription.successSub')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.noSubHeader}>
        <Ionicons name="card-outline" size={48} color="#D1D5DB" />
        <Text style={styles.noSubTitle}>{t('subscription.noActiveTitle')}</Text>
        <Text style={styles.noSubSub}>{t('subscription.noActiveSub')}</Text>
      </View>

      {loadingPlans ? (
        <ActivityIndicator color={AMBER} style={{ marginVertical: 32 }} />
      ) : plans.length === 0 ? (
        <Text style={{ textAlign: 'center', color: '#9CA3AF', marginVertical: 32 }}>
          {t('subscription.noPlans')}
        </Text>
      ) : (
        <>
          {/* Billing cycle toggle — only show if both cycles exist */}
          {monthlyPlan && annualPlan && (
            <View style={styles.cycleToggle}>
              <TouchableOpacity
                style={[styles.cycleBtn, billingCycle === 'monthly' && styles.cycleBtnActive]}
                onPress={() => setBillingCycle('monthly')}
              >
                <Text style={[styles.cycleBtnText, billingCycle === 'monthly' && styles.cycleBtnTextActive]}>
                  {t('subscription.monthly')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cycleBtn, billingCycle === 'annual' && styles.cycleBtnActive]}
                onPress={() => setBillingCycle('annual')}
              >
                <Text style={[styles.cycleBtnText, billingCycle === 'annual' && styles.cycleBtnTextActive]}>
                  {t('subscription.annual')} · {t('subscription.savePct', { pct: annualSaving })}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Plan card */}
          {selectedPlan && (
            <View style={styles.planSelectionCard}>
              <View style={styles.planSelectionHeader}>
                <Text style={styles.planSelectionName}>{selectedPlan.title}</Text>
                <View style={styles.planTypeBadge}>
                  <Text style={styles.planTypeBadgeText}>{selectedPlan.planType.toUpperCase()}</Text>
                </View>
              </View>

              <Text style={styles.planSelectionPrice}>
                {selectedPlan.price.toFixed(2)} €
                <Text style={styles.planSelectionCycle}>
                  {' '}/ {billingCycle === 'monthly' ? t('subscription.month') : t('subscription.year')}
                </Text>
              </Text>

              <View style={styles.featureList}>
                <PlanFeature icon="business-outline" text={t('subscription.feature.businesses', { n: selectedPlan.maxFeaturedDetail === -1 ? '∞' : selectedPlan.maxFeaturedDetail })} />
                <PlanFeature icon="location-outline" text={t('subscription.feature.steps', { n: selectedPlan.maxFeaturedSteps === -1 ? '∞' : selectedPlan.maxFeaturedSteps })} />
                <PlanFeature icon="language-outline" text={t('subscription.feature.languages', { n: selectedPlan.maxLanguages === -1 ? '∞' : selectedPlan.maxLanguages })} />
                {selectedPlan.featuredPerStep && (
                  <PlanFeature icon="star-outline" text={t('subscription.feature.featuredPerStep')} />
                )}
              </View>

              {/* Auto-renewal toggle */}
              {selectedPlan.autoRenewal && (
                <View style={styles.renewalRow}>
                  <Text style={styles.renewalLabel}>{t('subscription.autoRenewal')}</Text>
                  <Switch
                    value={autoRenewal}
                    onValueChange={setAutoRenewal}
                    trackColor={{ false: '#E5E7EB', true: AMBER }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              )}

              {/* Checkout */}
              {!checkoutOpen ? (
                <TouchableOpacity
                  style={styles.subscribeBtn}
                  onPress={() => setCheckoutOpen(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.subscribeBtnText}>
                    {t('subscription.subscribeCta', { price: selectedPlan.price.toFixed(2) })}
                  </Text>
                </TouchableOpacity>
              ) : (
                <SubscriptionCheckout
                  plan={selectedPlan}
                  autoRenewal={autoRenewal}
                  onSuccess={() => {
                    setSubscribeSuccess(true);
                    setTimeout(() => onSubscribed(), 1500);
                  }}
                  onCancel={() => setCheckoutOpen(false)}
                />
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ── Checkout component ────────────────────────────────────────────────────────

interface SubscriptionCheckoutProps {
  plan: SubscriptionPlan;
  autoRenewal: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

function SubscriptionCheckout(props: SubscriptionCheckoutProps) {
  if (Platform.OS !== 'web') {
    return <NativeCheckoutPlaceholder {...props} />;
  }
  return (
    <Elements stripe={getStripePromise()}>
      <StripeSubscriptionForm {...props} />
    </Elements>
  );
}

function StripeSubscriptionForm({ plan, autoRenewal, onSuccess, onCancel }: SubscriptionCheckoutProps) {
  const { t } = useTranslation();
  const stripe   = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    setError('');
    try {
      // 1. Create PaymentIntent on backend
      const intent = await createSubscriptionIntent(plan.id, autoRenewal);

      // 2. Confirm with CardElement
      const cardEl = elements.getElement(CardElement);
      if (!cardEl) throw new Error('Card not mounted');

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        intent.clientSecret,
        { payment_method: { card: cardEl } },
      );

      if (stripeError) {
        setError(stripeError.message ?? t('subscription.paymentError'));
        setProcessing(false);
        return;
      }

      // 3. Activate subscription on backend
      if (paymentIntent?.status === 'succeeded') {
        await activateSubscription(paymentIntent.id, plan.id, autoRenewal);
        onSuccess();
      }
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err.message ?? t('subscription.paymentError'));
      setProcessing(false);
    }
  };

  return (
    <View style={checkoutStyles.wrap}>
      <View style={checkoutStyles.header}>
        <Ionicons name="lock-closed-outline" size={14} color="#6B7280" />
        <Text style={checkoutStyles.headerText}>{t('subscription.securePayment')}</Text>
      </View>

      {/* Summary */}
      <View style={checkoutStyles.summary}>
        <Text style={checkoutStyles.summaryPlan}>{plan.title}</Text>
        <Text style={checkoutStyles.summaryPrice}>
          {plan.price.toFixed(2)} € / {plan.billingCycle === 'monthly' ? t('subscription.month') : t('subscription.year')}
        </Text>
      </View>

      {/* CardElement */}
      <View style={checkoutStyles.cardWrap}>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '15px',
                color: '#111827',
                fontFamily: 'system-ui, sans-serif',
                '::placeholder': { color: '#9CA3AF' },
              },
              invalid: { color: '#EF4444' },
            },
          }}
        />
      </View>

      {error ? <Text style={checkoutStyles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[checkoutStyles.payBtn, processing && checkoutStyles.payBtnDisabled]}
        onPress={handlePay}
        disabled={processing || !stripe}
        activeOpacity={0.85}
      >
        {processing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
            <Text style={checkoutStyles.payBtnText}>
              {t('subscription.payNow', { price: plan.price.toFixed(2) })}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={checkoutStyles.cancelLink} onPress={onCancel}>
        <Text style={checkoutStyles.cancelLinkText}>{t('subscription.cancelCheckout')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function NativeCheckoutPlaceholder({ plan, onCancel }: SubscriptionCheckoutProps) {
  const { t } = useTranslation();
  return (
    <View style={checkoutStyles.wrap}>
      <View style={checkoutStyles.nativePlaceholder}>
        <Ionicons name="phone-portrait-outline" size={32} color="#9CA3AF" />
        <Text style={checkoutStyles.nativePlaceholderText}>{t('subscription.nativeCheckoutHint')}</Text>
      </View>
      <TouchableOpacity style={checkoutStyles.cancelLink} onPress={onCancel}>
        <Text style={checkoutStyles.cancelLinkText}>{t('subscription.cancelCheckout')}</Text>
      </TouchableOpacity>
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

function PlanFeature({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <Ionicons name={icon as any} size={16} color={AMBER} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

// ── Checkout styles ───────────────────────────────────────────────────────────

const checkoutStyles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  headerText: { fontSize: 12, color: '#6B7280' },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  summaryPlan: { fontSize: 14, fontWeight: '600', color: '#374151' },
  summaryPrice: { fontSize: 14, fontWeight: '700', color: AMBER_DARK },
  cardWrap: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#FAFAFA',
  },
  errorText: { fontSize: 12, color: '#DC2626', textAlign: 'center' },
  payBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payBtnDisabled: { opacity: 0.55 },
  payBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  cancelLink: { alignItems: 'center', paddingVertical: 6 },
  cancelLinkText: { fontSize: 13, color: '#9CA3AF' },
  nativePlaceholder: { alignItems: 'center', gap: 10, paddingVertical: 20 },
  nativePlaceholderText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});

// ── Main styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 48,
  },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center', paddingHorizontal: 24 },

  // Plan card (active)
  planCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
  },
  planCardPremium: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  planName: { fontSize: 18, fontWeight: '800', color: '#111827' },
  planTypeBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  planTypeBadgeText: { fontSize: 11, fontWeight: '700', color: AMBER_DARK, letterSpacing: 1 },
  planPrice: { fontSize: 14, color: '#6B7280', fontWeight: '500' },

  // Section
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  infoValue: { fontSize: 14, color: '#111827', fontWeight: '600', textTransform: 'capitalize' },

  // Renewal
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
    marginBottom: 12,
    gap: 12,
  },
  renewalLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  renewalSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  // Cancel
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  cancelBtnText: { color: '#EF4444', fontWeight: '600', fontSize: 14 },

  // Limits
  limitsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  limitCard: {
    flex: 1,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  limitValue: { fontSize: 18, fontWeight: '800', color: AMBER_DARK },
  limitLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500', textAlign: 'center' },

  // Table
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
  tableCell: { fontSize: 14, color: '#374151' },
  tableHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // No subscription
  noSubHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  noSubTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  noSubSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 24 },

  // Cycle toggle
  cycleToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  cycleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  cycleBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.1)' } as any,
      default: { elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4 },
    }),
  },
  cycleBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  cycleBtnTextActive: { color: '#111827' },

  // Plan selection card
  planSelectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: AMBER,
    padding: 20,
    gap: 12,
  },
  planSelectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planSelectionName: { fontSize: 18, fontWeight: '800', color: '#111827' },
  planSelectionPrice: { fontSize: 26, fontWeight: '700', color: AMBER_DARK },
  planSelectionCycle: { fontSize: 14, fontWeight: '400', color: '#6B7280' },
  featureList: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 14, color: '#374151' },
  subscribeBtn: {
    backgroundColor: AMBER,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  subscribeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // Success
  successView: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 14,
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  successSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 24 },
});
