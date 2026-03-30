// components/dashboard/SubscriptionTab.tsx
// Subscription management: active plan details or plan selection + Stripe Checkout Elements

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getActiveSubscription, getSubscriptionPlans, getPaymentHistoryByUser } from '../../services/dashboard.service';
import { createStripeCheckoutSession, getCheckoutSessionStatus, cancelStripeSubscription, disableSubscriptionAutoRenewal, enableSubscriptionAutoRenewal } from '../../services/subscription.service';
import { getStripePromise } from '../../lib/stripe';
import type { Subscription, SubscriptionPlan, SubscriptionPayment } from '../../types';

// NEW: Import from @stripe/react-stripe-js/checkout instead of @stripe/react-stripe-js
// CheckoutProvider uses the CheckoutSession clientSecret (not a PaymentIntent secret).
// useCheckout() gives access to the checkout object and checkout.confirm() to complete payment.
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from '@stripe/react-stripe-js';

const AMBER = '#F59E0B';
const AMBER_DARK = '#D97706';

interface SubscriptionTabProps {
  userId: string;
  onScrollTop?: () => void;
}

function formatDate(dateStr: string | null | undefined, format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD/MM/YYYY HH:mm' = 'DD/MM/YYYY'): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh   = String(d.getHours()).padStart(2, '0');
  const min  = String(d.getMinutes()).padStart(2, '0');
  switch (format) {
    case 'MM/DD/YYYY':    return `${mm}/${dd}/${yyyy}`;
    case 'YYYY-MM-DD':    return `${yyyy}-${mm}-${dd}`;
    case 'DD/MM/YYYY HH:mm': return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    default:              return `${dd}/${mm}/${yyyy}`;
  }
}

function cycleLabel(billingCycle: string, t: (key: string) => string): string {
  if (billingCycle === 'monthly') return t('subscription.monthly');
  if (billingCycle === 'annual') return t('subscription.annual');
  if (billingCycle === 'minute') return t('subscription.minute');
  return billingCycle;
}

function cyclePriceUnit(billingCycle: string, t: (key: string) => string): string {
  if (billingCycle === 'monthly') return t('subscription.month');
  if (billingCycle === 'annual') return t('subscription.year');
  if (billingCycle === 'minute') return t('subscription.perMinute');
  return billingCycle;
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function SubscriptionTab({ userId, onScrollTop }: SubscriptionTabProps) {
  const { t } = useTranslation();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingRenewal, setUpdatingRenewal] = useState(false);
  const [cancelConfirming, setCancelConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

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

  const handleSubscribeSuccess = useCallback(() => {
    onScrollTop?.();
    loadSubscription();
    setSuccessToast(true);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccessToast(false), 3500);
  }, [loadSubscription, onScrollTop]);

  const handleAutoRenewalToggle = useCallback(
    async (value: boolean) => {
      if (!subscription) return;
      setUpdatingRenewal(true);
      try {
        if (!value) {
          await disableSubscriptionAutoRenewal(subscription.id);
        } else {
          await enableSubscriptionAutoRenewal(subscription.id);
        }
        setSubscription((prev) => (prev ? { ...prev, autoRenewal: value } : prev));
      } catch {
        // Revert on failure — state unchanged, switch reverts.
      } finally {
        setUpdatingRenewal(false);
      }
    },
    [subscription],
  );

  const handleCancelConfirmed = useCallback(async () => {
    if (!subscription) return;
    setCancelling(true);
    try {
      await cancelStripeSubscription(subscription.id);
      setSubscription((prev) => (prev ? { ...prev, autoRenewal: false } : prev));
      setCancelConfirming(false);
    } catch {
      setCancelConfirming(false);
    } finally {
      setCancelling(false);
    }
  }, [subscription]);

  const isExpired = subscription
    ? new Date(subscription.endDate) < new Date()
    : false;

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

  if (!subscription || isExpired) {
    return <NoSubscriptionView onSubscribed={handleSubscribeSuccess} userId={userId} />;
  }

  const plan = subscription.plan;
  const maxBusinessLabel = plan.maxFeaturedDetail === -1 ? t('dashboard.subscription.unlimited') : String(plan.maxFeaturedDetail);
  const maxStepsLabel    = plan.maxFeaturedSteps === -1   ? t('dashboard.subscription.unlimited') : String(plan.maxFeaturedSteps);
  const maxLangLabel     = plan.maxLanguages === -1       ? t('dashboard.subscription.unlimited') : String(plan.maxLanguages);

  return (
    <View style={styles.container}>
      {successToast && (
        <View style={styles.successToast}>
          <Ionicons name="checkmark-circle" size={18} color="#15803D" />
          <Text style={styles.successToastText}>{t('subscription.successTitle')}</Text>
          <TouchableOpacity onPress={() => setSuccessToast(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={16} color="#15803D" />
          </TouchableOpacity>
        </View>
      )}

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
            : `${plan.price} € / ${cycleLabel(plan.billingCycle, t).toLowerCase()}`}
        </Text>
      </View>

      <View style={styles.section}>
        <InfoRow label={t('dashboard.subscription.cycle')} value={cycleLabel(plan.billingCycle, t)} />
        <InfoRow label={t('dashboard.subscription.starts')} value={formatDate(subscription.startDate)} />
        <InfoRow label={t('dashboard.subscription.ends')} value={formatDate(subscription.endDate)} />
        <InfoRow label={t('dashboard.subscription.type')} value={subscription.status === 'active' ? t('subscription.statusActive') : subscription.status} />
      </View>

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

      {!subscription.autoRenewal && (
        <View style={styles.warningBox}>
          <Ionicons name="information-circle-outline" size={18} color="#92400E" />
          <Text style={styles.warningText}>
            {t('subscription.renewalDisabledWarning', { date: formatDate(subscription.endDate) })}
          </Text>
        </View>
      )}

      {subscription.autoRenewal && !cancelConfirming && (
        <TouchableOpacity style={styles.cancelBtn} onPress={() => setCancelConfirming(true)}>
          <Text style={styles.cancelBtnText}>{t('subscription.cancel')}</Text>
        </TouchableOpacity>
      )}

      {cancelConfirming && (
        <View style={styles.cancelConfirmBox}>
          <Text style={styles.cancelConfirmText}>
            {t('subscription.cancelConfirm', { date: formatDate(subscription.endDate) })}
          </Text>
          <View style={styles.cancelConfirmBtns}>
            <TouchableOpacity
              style={styles.cancelConfirmBack}
              onPress={() => setCancelConfirming(false)}
              disabled={cancelling}
            >
              <Text style={styles.cancelConfirmBackText}>{t('subscription.cancelBack')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelConfirmDo}
              onPress={handleCancelConfirmed}
              disabled={cancelling}
            >
              {cancelling
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.cancelConfirmDoText}>{t('subscription.cancelConfirmBtn')}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>{t('dashboard.subscription.limits')}</Text>
      <View style={styles.limitsGrid}>
        <LimitCard icon="business-outline" label={t('dashboard.subscription.maxBusiness')} value={maxBusinessLabel} />
        <LimitCard icon="location-outline" label={t('subscription.maxSteps')} value={maxStepsLabel} />
        <LimitCard icon="language-outline" label={t('dashboard.subscription.maxLanguages')} value={maxLangLabel} />
      </View>

      <PaymentHistorySection userId={userId} />
    </View>
  );
}

// ── No subscription view ──────────────────────────────────────────────────────

interface NoSubscriptionViewProps {
  onSubscribed: () => void;
  userId: string;
}

function NoSubscriptionView({ onSubscribed, userId }: NoSubscriptionViewProps) {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    getSubscriptionPlans()
      .then((data) => {
        setPlans(data);
        if (data.length > 0) setSelectedPlan(data[0]);
      })
      .catch(() => {})
      .finally(() => setLoadingPlans(false));
  }, []);

  return (
    <View style={styles.container}>
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
          <View style={styles.planList}>
            {plans.map((plan) => {
              const isSelected = selectedPlan?.id === plan.id;
              return (
                <TouchableOpacity
                  key={plan.id}
                  style={[styles.planPickerCard, isSelected && styles.planPickerCardSelected]}
                  onPress={() => {
                    setSelectedPlan(plan);
                    setCheckoutOpen(false);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.planPickerRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planPickerName}>{plan.title}</Text>
                      <Text style={styles.planPickerCycle}>{cycleLabel(plan.billingCycle, t)}</Text>
                    </View>
                    <View style={styles.planPickerPriceCol}>
                      <Text style={[styles.planPickerPrice, isSelected && styles.planPickerPriceSelected]}>
                        {plan.price.toFixed(2)} €
                      </Text>
                      <Text style={styles.planPickerPriceUnit}>/ {cyclePriceUnit(plan.billingCycle, t)}</Text>
                    </View>
                    <View style={[styles.planPickerRadio, isSelected && styles.planPickerRadioSelected]}>
                      {isSelected && <View style={styles.planPickerRadioDot} />}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

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
                  {' '}/ {cyclePriceUnit(selectedPlan.billingCycle, t)}
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
                  onSuccess={onSubscribed}
                  onCancel={() => setCheckoutOpen(false)}
                />
              )}
            </View>
          )}
        </>
      )}

      <PaymentHistorySection userId={userId} />
    </View>
  );
}

// ── Checkout component ────────────────────────────────────────────────────────
//
// NEW FLOW:
// 1. Backend creates a CheckoutSession (mode=subscription, ui_mode=elements)
//    and returns { clientSecret, checkoutSessionId }.
// 2. Frontend wraps with CheckoutProvider using that clientSecret.
// 3. Inside the provider, StripeCheckoutForm renders a <PaymentElement> and
//    calls checkout.confirm() when the user clicks Pay.
// 4. On success, the frontend calls sessionStatus() to verify the session is
//    'complete', then calls onSuccess() to refresh the parent.
// 5. Drupal node creation happens in the webhook (checkout.session.completed).

interface SubscriptionCheckoutProps {
  plan: SubscriptionPlan;
  onSuccess: () => void;
  onCancel: () => void;
}

function SubscriptionCheckout(props: SubscriptionCheckoutProps) {
  const { t } = useTranslation();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null);
  const [initError, setInitError] = useState('');
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setInitializing(true);
    setInitError('');

    createStripeCheckoutSession(props.plan.id)
      .then((result) => {
        if (cancelled) return;
        setClientSecret(result.clientSecret);
        setCheckoutSessionId(result.checkoutSessionId);
      })
      .catch((err: any) => {
        if (cancelled) return;
        const code = err?.response?.data?.code;
        if (code === 'ALREADY_SUBSCRIBED') {
          setInitError(t('subscription.alreadySubscribed'));
        } else {
          setInitError(err?.response?.data?.error ?? err.message ?? t('subscription.paymentError'));
        }
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    return () => { cancelled = true; };
  }, [props.plan.id, t]);

  if (Platform.OS !== 'web') {
    return <NativeCheckoutPlaceholder onCancel={props.onCancel} />;
  }

  if (initializing) {
    return (
      <View style={checkoutStyles.wrap}>
        <ActivityIndicator color={AMBER} style={{ marginVertical: 20 }} />
      </View>
    );
  }

  if (initError) {
    return (
      <View style={checkoutStyles.wrap}>
        <Text style={checkoutStyles.errorText}>{initError}</Text>
        <TouchableOpacity style={checkoutStyles.cancelLink} onPress={props.onCancel}>
          <Text style={checkoutStyles.cancelLinkText}>{t('subscription.cancelCheckout')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!clientSecret) {
    return null;
  }

  // EmbeddedCheckoutProvider + EmbeddedCheckout renderizan el formulario
  // completo de Stripe en un iframe. No necesitamos PaymentElement ni useCheckout.
  // onComplete se llama cuando Stripe confirma el pago internamente.
  const handleComplete = async () => {
    if (!checkoutSessionId) return;
    try {
      const status = await getCheckoutSessionStatus(checkoutSessionId);
      if (status.status === 'complete') {
        props.onSuccess();
      }
    } catch {
      // Si falla la verificación, onSuccess igualmente — el webhook creará el nodo.
      props.onSuccess();
    }
  };

  return (
    <View style={checkoutStyles.wrap}>
      <View style={checkoutStyles.header}>
        <Ionicons name="lock-closed-outline" size={14} color="#6B7280" />
        <Text style={checkoutStyles.headerText}>{t('subscription.securePayment')}</Text>
      </View>

      {/* EmbeddedCheckout necesita estar dentro de un div con altura fija en web */}
      <View style={checkoutStyles.embeddedWrap}>
        <EmbeddedCheckoutProvider
          stripe={getStripePromise()}
          options={{
            clientSecret,
            onComplete: handleComplete,
          }}
        >
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </View>

      <TouchableOpacity style={checkoutStyles.cancelLink} onPress={props.onCancel}>
        <Text style={checkoutStyles.cancelLinkText}>{t('subscription.cancelCheckout')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Stripe Checkout form (web only) ──────────────────────────────────────────

interface StripeCheckoutFormProps {
  plan: SubscriptionPlan;
  checkoutSessionId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function StripeCheckoutForm({ plan, checkoutSessionId, onSuccess, onCancel }: StripeCheckoutFormProps) {
  const { t }      = useTranslation();
  const checkoutState = useCheckout();
  const [processing, setProcessing] = useState(false);
  const [error, setError]           = useState('');

  if (checkoutState.type === 'loading') {
    return (
      <View style={checkoutStyles.wrap}>
        <ActivityIndicator color={AMBER} style={{ marginVertical: 20 }} />
      </View>
    );
  }

  if (checkoutState.type === 'error') {
    return (
      <View style={checkoutStyles.wrap}>
        <Text style={checkoutStyles.errorText}>{checkoutState.error.message}</Text>
        <TouchableOpacity style={checkoutStyles.cancelLink} onPress={onCancel}>
          <Text style={checkoutStyles.cancelLinkText}>{t('subscription.cancelCheckout')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { checkout } = checkoutState;

  const handlePay = async () => {
    setProcessing(true);
    setError('');

    try {
      // checkout.confirm() handles everything:
      // - Collects payment details from the embedded PaymentElement
      // - Confirms the payment with Stripe
      // - For 3DS/redirect methods, redirects to return_url automatically
      // - For card payments, resolves inline
      const result = await checkout.confirm();

      if (result.type === 'error') {
        setError(result.error.message ?? t('subscription.paymentError'));
        setProcessing(false);
        return;
      }

      // Payment succeeded — verify via session-status endpoint.
      // The webhook will create the Drupal node asynchronously.
      // We just need to confirm the session is 'complete' for the UI.
      const status = await getCheckoutSessionStatus(checkoutSessionId);
      if (status.status === 'complete') {
        onSuccess();
      } else {
        setError(t('subscription.paymentError'));
      }
    } catch (err: any) {
      setError(err?.message ?? t('subscription.paymentError'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={checkoutStyles.wrap}>
      <View style={checkoutStyles.header}>
        <Ionicons name="lock-closed-outline" size={14} color="#6B7280" />
        <Text style={checkoutStyles.headerText}>{t('subscription.securePayment')}</Text>
      </View>

      <View style={checkoutStyles.summary}>
        <Text style={checkoutStyles.summaryPlan}>{plan.title}</Text>
        <Text style={checkoutStyles.summaryPrice}>
          {plan.price.toFixed(2)} € / {cyclePriceUnit(plan.billingCycle, t)}
        </Text>
      </View>

      {/* PaymentElement renders all Stripe-supported payment methods.
          It is controlled by the CheckoutProvider context — no
          explicit stripe/elements props needed here. */}
      <View style={checkoutStyles.cardWrap}>
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </View>

      {error ? <Text style={checkoutStyles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[checkoutStyles.payBtn, processing && checkoutStyles.payBtnDisabled]}
        onPress={handlePay}
        disabled={processing}
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

function NativeCheckoutPlaceholder({ onCancel }: { onCancel: () => void }) {
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

// ── Payment history ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const normalized = status === 'succeeded' ? 'succeed' : status;
  const config = ({
    succeed:  { label: t('subscription.status.paid'),     bg: '#DCFCE7', text: '#15803D' },
    failed:   { label: t('subscription.status.failed'),   bg: '#FEE2E2', text: '#DC2626' },
    refunded: { label: t('subscription.status.refunded'), bg: '#FEF3C7', text: '#D97706' },
  } as Record<string, { label: string; bg: string; text: string }>)[normalized] ?? { label: '—', bg: '#F3F4F6', text: '#6B7280' };

  return (
    <View style={{ backgroundColor: config.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: config.text }}>{config.label}</Text>
    </View>
  );
}

function PaymentHistorySection({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPaymentHistoryByUser(userId)
      .then(setPayments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return <ActivityIndicator color={AMBER} style={{ marginVertical: 16 }} />;
  }

  return (
    <>
      <Text style={styles.sectionTitle}>{t('subscription.paymentHistoryTitle')}</Text>
      <View style={styles.section}>
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          <Text style={[styles.tableCell, styles.tableHeader, { flex: 1.4 }]}>{t('dashboard.donations.date')}</Text>
          <Text style={[styles.tableCell, styles.tableHeader, { flex: 2 }]}>{t('subscription.plan')}</Text>
          <Text style={[styles.tableCell, styles.tableHeader, { flex: 1.1, textAlign: 'right' }]}>{t('subscription.amount')}</Text>
          <Text style={[styles.tableCell, styles.tableHeader, { flex: 0.9, textAlign: 'right' }]}>{t('subscription.status')}</Text>
        </View>
        {payments.length === 0 ? (
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { color: '#9CA3AF' }]}>{t('subscription.noPayments')}</Text>
          </View>
        ) : (
          payments.map((p) => (
            <View key={p.id} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1.4 }]}>{formatDate(p.periodStart, 'DD/MM/YYYY HH:mm')}</Text>
              <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{p.planTitle}</Text>
              <Text style={[styles.tableCell, { flex: 1.1, textAlign: 'right', color: '#16A34A', fontWeight: '600' }]}>
                {p.amount.toFixed(2)} €
              </Text>
              <View style={[styles.tableCell, { flex: 0.9, alignItems: 'flex-end' }]}>
                <StatusBadge status={p.status} />
              </View>
            </View>
          ))
        )}
      </View>
    </>
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
  embeddedWrap: {
    minHeight: 400,
    width: '100%',
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

  successToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  successToastText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#15803D' },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  warningText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },

  cancelBtn: {
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  cancelBtnText: { color: '#EF4444', fontWeight: '600', fontSize: 14 },
  cancelConfirmBox: {
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  cancelConfirmText: { fontSize: 13, color: '#374151', textAlign: 'center' },
  cancelConfirmBtns: { flexDirection: 'row', gap: 10 },
  cancelConfirmBack: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelConfirmBackText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  cancelConfirmDo: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelConfirmDoText: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },

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

  noSubHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  noSubTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  noSubSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 24 },

  planList: {
    gap: 10,
    marginBottom: 16,
  },
  planPickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  planPickerCardSelected: {
    borderColor: AMBER,
    backgroundColor: '#FFFBEB',
  },
  planPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planPickerName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  planPickerCycle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  planPickerPriceCol: { alignItems: 'flex-end' },
  planPickerPrice: { fontSize: 16, fontWeight: '700', color: '#374151' },
  planPickerPriceSelected: { color: AMBER_DARK },
  planPickerPriceUnit: { fontSize: 11, color: '#9CA3AF' },
  planPickerRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planPickerRadioSelected: { borderColor: AMBER },
  planPickerRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: AMBER,
  },

  planSelectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: AMBER,
    padding: 20,
    gap: 12,
    marginBottom: 30,
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
});
