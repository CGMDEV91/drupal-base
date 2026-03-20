// components/dashboard/SubscriptionTab.tsx
// Subscription management: active plan details or plan selection

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
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

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

export function SubscriptionTab({ userId }: SubscriptionTabProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

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
        // Revert on failure — no-op
      } finally {
        setUpdatingRenewal(false);
      }
    },
    [subscription]
  );

  const handleCancelSubscription = useCallback(() => {
    if (!subscription) return;
    const endDate = formatDate(subscription.endDate);
    Alert.alert(
      'Cancelar suscripción',
      `Al cancelar, seguirás teniendo acceso hasta el ${endDate}. Después de esa fecha no se renovará.`,
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: 'Cancelar suscripción',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateSubscription(subscription.id, false);
              setSubscription((prev) => (prev ? { ...prev, autoRenewal: false } : prev));
            } catch {
              Alert.alert('Error', 'No se pudo cancelar la suscripción. Inténtalo de nuevo.');
            }
          },
        },
      ]
    );
  }, [subscription]);

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

  // ── State B: No active subscription ────────────────────────────────────────
  if (!subscription) {
    return <NoSubscriptionView />;
  }

  // ── State A: Active subscription ───────────────────────────────────────────
  const plan = subscription.plan;
  const maxBusinessLabel =
    plan.maxFeaturedDetail === -1 ? 'Ilimitado' : String(plan.maxFeaturedDetail);
  const maxStepsLabel =
    plan.maxFeaturedSteps === -1 ? 'Ilimitado' : String(plan.maxFeaturedSteps);
  const maxLangLabel =
    plan.maxLanguages === -1 ? 'Ilimitado' : String(plan.maxLanguages);

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
          {plan.price === 0 ? 'Gratuito' : `${plan.price} € / ${plan.billingCycle === 'monthly' ? 'mes' : 'año'}`}
        </Text>
      </View>

      {/* Details */}
      <View style={styles.section}>
        <InfoRow label="Ciclo de facturación" value={plan.billingCycle === 'monthly' ? 'Mensual' : plan.billingCycle === 'annual' ? 'Anual' : '—'} />
        <InfoRow label="Fecha de inicio" value={formatDate(subscription.startDate)} />
        <InfoRow label="Válido hasta" value={formatDate(subscription.endDate)} />
        <InfoRow label="Estado" value={subscription.status === 'active' ? 'Activa' : subscription.status} />
      </View>

      {/* Auto-renewal toggle */}
      <View style={styles.renewalRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.renewalLabel}>{t('dashboard.subscription.autoRenewal')}</Text>
          <Text style={styles.renewalSub}>
            {subscription.autoRenewal
              ? `Se renovará el ${formatDate(subscription.endDate)}`
              : `Expira el ${formatDate(subscription.endDate)}`}
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

      {/* Cancel button */}
      {subscription.autoRenewal && (
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelSubscription}>
          <Text style={styles.cancelBtnText}>Cancelar suscripción</Text>
        </TouchableOpacity>
      )}

      {/* Plan limits */}
      <Text style={styles.sectionTitle}>{t('dashboard.subscription.limits')}</Text>
      <View style={styles.limitsGrid}>
        <LimitCard icon="business-outline" label="Negocios en tour" value={maxBusinessLabel} />
        <LimitCard icon="location-outline" label="Negocios en steps" value={maxStepsLabel} />
        <LimitCard icon="language-outline" label="Idiomas" value={maxLangLabel} />
      </View>

      {/* Payment history */}
      <Text style={styles.sectionTitle}>Historial de pagos</Text>
      <View style={styles.section}>
        {/* Header */}
        <View style={[styles.tableRow, styles.tableHeaderRow]}>
          <Text style={[styles.tableCell, styles.tableHeader, { flex: 1.5 }]}>Fecha</Text>
          <Text style={[styles.tableCell, styles.tableHeader, { flex: 2 }]}>Plan</Text>
          <Text style={[styles.tableCell, styles.tableHeader, { flex: 1 }]}>Ciclo</Text>
          <Text style={[styles.tableCell, styles.tableHeader, { flex: 1, textAlign: 'right' }]}>Importe</Text>
        </View>
        {subscription.lastPaymentAt ? (
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>{formatDateShort(subscription.lastPaymentAt)}</Text>
            <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{plan.title}</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.cycleBadge}>
                <Text style={styles.cycleBadgeText}>
                  {plan.billingCycle === 'monthly' ? 'Mensual' : 'Anual'}
                </Text>
              </View>
            </View>
            <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', color: '#16A34A', fontWeight: '600' }]}>
              {plan.price.toFixed(2)} €
            </Text>
          </View>
        ) : (
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { color: '#9CA3AF' }]}>Sin pagos registrados</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── No subscription view ──────────────────────────────────────────────────────

function NoSubscriptionView() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [autoRenewal, setAutoRenewal] = useState(true);

  return (
    <View style={styles.container}>
      <View style={styles.noSubHeader}>
        <Ionicons name="card-outline" size={48} color="#D1D5DB" />
        <Text style={styles.noSubTitle}>Sin suscripción activa</Text>
        <Text style={styles.noSubSub}>
          Elige un plan para publicar tours con negocios destacados y más idiomas.
        </Text>
      </View>

      {/* Billing cycle toggle */}
      <View style={styles.cycleToggle}>
        <TouchableOpacity
          style={[styles.cycleBtn, billingCycle === 'monthly' && styles.cycleBtnActive]}
          onPress={() => setBillingCycle('monthly')}
        >
          <Text style={[styles.cycleBtnText, billingCycle === 'monthly' && styles.cycleBtnTextActive]}>
            Mensual
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cycleBtn, billingCycle === 'annual' && styles.cycleBtnActive]}
          onPress={() => setBillingCycle('annual')}
        >
          <Text style={[styles.cycleBtnText, billingCycle === 'annual' && styles.cycleBtnTextActive]}>
            Anual · Ahorra 20%
          </Text>
        </TouchableOpacity>
      </View>

      {/* Plan card */}
      <View style={styles.planSelectionCard}>
        <Text style={styles.planSelectionName}>Plan Premium</Text>
        <Text style={styles.planSelectionPrice}>
          {billingCycle === 'monthly' ? '9.99 € / mes' : '95.90 € / año'}
        </Text>
        <View style={styles.featureList}>
          {[
            'Hasta 3 negocios destacados por tour',
            'Hasta 5 negocios por step',
            'Hasta 5 idiomas',
            'Estadísticas avanzadas',
          ].map((f) => (
            <View key={f} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color={AMBER} />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Auto-renewal toggle */}
        <View style={styles.renewalRow}>
          <Text style={styles.renewalLabel}>Renovación automática</Text>
          <Switch
            value={autoRenewal}
            onValueChange={setAutoRenewal}
            trackColor={{ false: '#E5E7EB', true: AMBER }}
            thumbColor="#FFFFFF"
          />
        </View>

        <TouchableOpacity
          style={styles.subscribeBtn}
          onPress={() => Alert.alert('Próximamente', 'El pago con tarjeta estará disponible pronto.')}
        >
          <Text style={styles.subscribeBtnText}>Contratar plan Premium</Text>
        </TouchableOpacity>
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
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 48,
  },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center', paddingHorizontal: 24 },

  // Plan card
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
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
    marginBottom: 12,
    gap: 12,
  },
  renewalLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  renewalSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  // Cancel button
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

  // Payment table
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
  cycleBadge: {
    backgroundColor: '#EDE9FE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  cycleBadgeText: { fontSize: 11, color: '#7C3AED', fontWeight: '600' },

  // No subscription
  noSubHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  noSubTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  noSubSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 24 },

  // Billing cycle toggle
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
  cycleBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
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
  planSelectionName: { fontSize: 18, fontWeight: '800', color: '#111827' },
  planSelectionPrice: { fontSize: 22, fontWeight: '700', color: AMBER_DARK },
  featureList: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 14, color: '#374151' },
  subscribeBtn: {
    backgroundColor: AMBER,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  subscribeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
