// components/admin/SiteSettingsTab.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  getSiteSettings,
  updateSiteSettings,
  updateStripeKeys,
  type SocialLink,
} from '../../services/admin.service';
import { resetStripePromise } from '../../lib/stripe';

const AMBER = '#F59E0B';
const STRIPE_COLOR = '#6772E5';

// ── Inner tabs ───────────────────────────────────────────────────────────────

type SettingsTab = 'general' | 'stripe';

interface InnerTab {
  id: SettingsTab;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const INNER_TABS: InnerTab[] = [
  { id: 'general', labelKey: 'admin.settings.tabs.general', icon: 'settings-outline', color: AMBER },
  { id: 'stripe',  labelKey: 'admin.settings.tabs.stripe',  icon: 'card-outline',     color: STRIPE_COLOR },
];

// ── State interfaces ─────────────────────────────────────────────────────────

interface SocialState {
  facebook: SocialLink;
  twitter: SocialLink;
  instagram: SocialLink;
}

interface PaymentState {
  platformRevenuePercentage: number;
  stripeConfigured: boolean;
}

interface StripeFormState {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  secretKeyConfigured: boolean;
  webhookConfigured: boolean;
  showSecretKey: boolean;
  showWebhookSecret: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const NETWORKS = [
  { key: 'facebook' as const, icon: 'logo-facebook' as const, label: 'Facebook' },
  { key: 'twitter'  as const, icon: 'logo-twitter'  as const, label: 'Twitter / X' },
  { key: 'instagram' as const, icon: 'logo-instagram' as const, label: 'Instagram' },
];

const DEFAULT_SOCIAL: SocialState = {
  facebook:  { url: '', visible: true },
  twitter:   { url: '', visible: true },
  instagram: { url: '', visible: true },
};

// ── Component ────────────────────────────────────────────────────────────────

export function SiteSettingsTab() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const [social,  setSocial]  = useState<SocialState>(DEFAULT_SOCIAL);
  const [payment, setPayment] = useState<PaymentState>({ platformRevenuePercentage: 20, stripeConfigured: false });
  const [stripe,  setStripe]  = useState<StripeFormState>({
    publishableKey: '', secretKey: '', webhookSecret: '',
    secretKeyConfigured: false, webhookConfigured: false,
    showSecretKey: false, showWebhookSecret: false,
  });
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [savingStripe, setSavingStripe] = useState(false);

  const [feedback,       setFeedback]       = useState<Feedback | null>(null);
  const [stripeFeedback, setStripeFeedback] = useState<Feedback | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    getSiteSettings()
      .then((data: any) => {
        if (data.socialLinks) {
          setSocial({
            facebook:  data.socialLinks.facebook  ?? DEFAULT_SOCIAL.facebook,
            twitter:   data.socialLinks.twitter   ?? DEFAULT_SOCIAL.twitter,
            instagram: data.socialLinks.instagram ?? DEFAULT_SOCIAL.instagram,
          });
        }
        if (data.paymentSettings) {
          setPayment({
            platformRevenuePercentage: data.paymentSettings.platformRevenuePercentage ?? 20,
            stripeConfigured: data.paymentSettings.stripeConfigured ?? false,
          });
        }
        if (data.stripeSettings) {
          setStripe((prev) => ({
            ...prev,
            publishableKey:       data.stripeSettings.publishableKey ?? '',
            secretKeyConfigured:  data.stripeSettings.secretKeyConfigured ?? false,
            webhookConfigured:    data.stripeSettings.webhookConfigured ?? false,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── General handlers ──────────────────────────────────────────────────────

  const handleUrlChange = (network: keyof SocialState, url: string) => {
    setSocial((prev) => ({ ...prev, [network]: { ...prev[network], url } }));
    setFeedback(null);
  };

  const handleVisibleChange = (network: keyof SocialState, visible: boolean) => {
    setSocial((prev) => ({ ...prev, [network]: { ...prev[network], visible } }));
    setFeedback(null);
  };

  const handlePercentageChange = (text: string) => {
    const val = parseInt(text, 10);
    setPayment((prev) => ({
      ...prev,
      platformRevenuePercentage: isNaN(val) ? 0 : Math.max(0, Math.min(100, val)),
    }));
    setFeedback(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await updateSiteSettings({
        socialLinks: social,
        paymentSettings: { platformRevenuePercentage: payment.platformRevenuePercentage },
      } as any);
      setFeedback({ type: 'success', message: t('admin.settings.saved') });
    } catch {
      setFeedback({ type: 'error', message: t('admin.settings.error') });
    } finally {
      setSaving(false);
    }
  };

  // ── Stripe handlers ───────────────────────────────────────────────────────

  const handleSaveStripe = async () => {
    setSavingStripe(true);
    setStripeFeedback(null);
    try {
      const payload: Record<string, string> = {};
      if (stripe.publishableKey.trim()) payload.publishableKey = stripe.publishableKey.trim();
      if (stripe.secretKey.trim())      payload.secretKey      = stripe.secretKey.trim();
      if (stripe.webhookSecret.trim())  payload.webhookSecret  = stripe.webhookSecret.trim();

      const updated = await updateStripeKeys(payload);

      if (updated.stripeSettings) {
        setStripe((prev) => ({
          ...prev,
          publishableKey:      updated.stripeSettings!.publishableKey ?? prev.publishableKey,
          secretKeyConfigured: updated.stripeSettings!.secretKeyConfigured,
          webhookConfigured:   updated.stripeSettings!.webhookConfigured,
          secretKey:    '',
          webhookSecret: '',
        }));
      }
      if (updated.paymentSettings) {
        setPayment((prev) => ({ ...prev, stripeConfigured: updated.paymentSettings!.stripeConfigured }));
      }
      resetStripePromise();
      setStripeFeedback({ type: 'success', message: t('admin.settings.stripeSaved') });
    } catch {
      setStripeFeedback({ type: 'error', message: t('admin.settings.error') });
    } finally {
      setSavingStripe(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  return (
    <View>
      {/* ── Inner tab bar ───────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.innerTabBar}
        style={styles.innerTabBarScroll}
      >
        {INNER_TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.innerTabPill, isActive && { backgroundColor: tab.color }]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab.icon}
                size={15}
                color={isActive ? '#FFFFFF' : '#6B7280'}
              />
              <Text style={[styles.innerTabLabel, isActive && styles.innerTabLabelActive]}>
                {t(tab.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      {activeTab === 'general' && (
        <View>
          {/* Social Links */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="share-social-outline" size={20} color={AMBER} />
              <Text style={styles.cardTitle}>{t('admin.settings.socialLinks')}</Text>
            </View>
            {NETWORKS.map((net, idx) => (
              <View key={net.key}>
                {idx > 0 && <View style={styles.divider} />}
                <View style={styles.row}>
                  <View style={styles.iconCircle}>
                    <Ionicons name={net.icon} size={18} color="#6B7280" />
                  </View>
                  <View style={styles.inputWrap}>
                    <Text style={styles.inputLabel}>{net.label}</Text>
                    <TextInput
                      style={styles.input}
                      value={social[net.key].url}
                      onChangeText={(val) => handleUrlChange(net.key, val)}
                      placeholder={`https://${net.key}.com/...`}
                      placeholderTextColor="#D1D5DB"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <View style={styles.switchWrap}>
                    <Text style={styles.switchLabel}>{t('admin.settings.socialVisible')}</Text>
                    <Switch
                      value={social[net.key].visible}
                      onValueChange={(val) => handleVisibleChange(net.key, val)}
                      trackColor={{ false: '#D1D5DB', true: AMBER + '80' }}
                      thumbColor={social[net.key].visible ? AMBER : '#F3F4F6'}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Revenue Split */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="cash-outline" size={20} color={AMBER} />
              <Text style={styles.cardTitle}>{t('admin.settings.revenueSplit')}</Text>
            </View>
            <View style={styles.row}>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>{t('admin.settings.platformPercentage')}</Text>
                <TextInput
                  style={[styles.input, { width: 80, textAlign: 'center' }]}
                  value={String(payment.platformRevenuePercentage)}
                  onChangeText={handlePercentageChange}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
              <View style={styles.splitPreview}>
                <View style={styles.splitRow}>
                  <Ionicons name="business-outline" size={14} color="#059669" />
                  <Text style={styles.splitText}>
                    {t('donation.split.platform')}: {payment.platformRevenuePercentage}%
                  </Text>
                </View>
                <View style={styles.splitRow}>
                  <Ionicons name="person-outline" size={14} color="#2563EB" />
                  <Text style={styles.splitText}>
                    {t('donation.split.guide')}: {100 - payment.platformRevenuePercentage}%
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.infoNote}>
              <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
              <Text style={styles.infoNoteText}>{t('admin.settings.adminOwnerNote')}</Text>
            </View>
          </View>

          {feedback && <FeedbackBanner feedback={feedback} />}
          <SaveButton onPress={handleSave} loading={saving} label={t('admin.settings.save')} />
        </View>
      )}

      {activeTab === 'stripe' && (
        <View>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="card-outline" size={20} color={STRIPE_COLOR} />
              <Text style={styles.cardTitle}>{t('admin.settings.stripeConfig')}</Text>
              <StatusBadge
                configured={payment.stripeConfigured}
                labelYes={t('admin.settings.stripeConnected')}
                labelNo={t('admin.settings.stripeNotConfigured')}
              />
            </View>

            <View style={styles.infoNote}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#6B7280" />
              <Text style={styles.infoNoteText}>{t('admin.settings.stripeKeysNote')}</Text>
            </View>

            <View style={styles.stripeFieldsWrap}>
              <View style={styles.stripeField}>
                <Text style={styles.inputLabel}>{t('admin.settings.stripePublishableKey')}</Text>
                <TextInput
                  style={styles.input}
                  value={stripe.publishableKey}
                  onChangeText={(v) => setStripe((prev) => ({ ...prev, publishableKey: v }))}
                  placeholder="pk_test_..."
                  placeholderTextColor="#D1D5DB"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <SecretField
                label={
                  t('admin.settings.stripeSecretKey') +
                  (stripe.secretKeyConfigured ? `  ✓ ${t('admin.settings.keySet')}` : '')
                }
                value={stripe.secretKey}
                onChangeText={(v) => setStripe((prev) => ({ ...prev, secretKey: v }))}
                placeholder={stripe.secretKeyConfigured ? '••••••••••••••••••••' : 'sk_test_...'}
                show={stripe.showSecretKey}
                onToggleShow={() => setStripe((prev) => ({ ...prev, showSecretKey: !prev.showSecretKey }))}
              />

              <SecretField
                label={
                  t('admin.settings.stripeWebhookSecret') +
                  (stripe.webhookConfigured ? `  ✓ ${t('admin.settings.keySet')}` : '')
                }
                value={stripe.webhookSecret}
                onChangeText={(v) => setStripe((prev) => ({ ...prev, webhookSecret: v }))}
                placeholder={stripe.webhookConfigured ? '••••••••••••••••••••' : 'whsec_...'}
                show={stripe.showWebhookSecret}
                onToggleShow={() => setStripe((prev) => ({ ...prev, showWebhookSecret: !prev.showWebhookSecret }))}
              />
            </View>

            <View style={styles.hintRow}>
              <Ionicons name="open-outline" size={14} color="#6B7280" />
              <Text style={styles.hintText}>{t('admin.settings.stripeDashboardHint')}</Text>
            </View>
          </View>

          {stripeFeedback && <FeedbackBanner feedback={stripeFeedback} />}
          <SaveButton
            onPress={handleSaveStripe}
            loading={savingStripe}
            label={t('admin.settings.saveStripeKeys')}
            icon="card-outline"
            color={STRIPE_COLOR}
          />
        </View>
      )}

    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

type Feedback = { type: 'success' | 'error'; message: string };

function FeedbackBanner({ feedback }: { feedback: Feedback }) {
  return (
    <View style={[styles.feedbackBanner, feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError]}>
      <Ionicons
        name={feedback.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
        size={18}
        color={feedback.type === 'success' ? '#065F46' : '#991B1B'}
      />
      <Text style={[styles.feedbackText, feedback.type === 'success' ? styles.feedbackTextSuccess : styles.feedbackTextError]}>
        {feedback.message}
      </Text>
    </View>
  );
}

function StatusBadge({
  configured,
  labelYes,
  labelNo,
}: {
  configured: boolean;
  labelYes: string;
  labelNo: string;
}) {
  return (
    <View style={styles.statusBadge}>
      <View style={[styles.statusDot, configured ? styles.statusDotGreen : styles.statusDotRed]} />
      <Text style={[styles.statusText, { color: configured ? '#059669' : '#DC2626' }]}>
        {configured ? labelYes : labelNo}
      </Text>
    </View>
  );
}

function SecretField({
  label,
  value,
  onChangeText,
  placeholder,
  show,
  onToggleShow,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  show: boolean;
  onToggleShow: () => void;
}) {
  return (
    <View style={styles.stripeField}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#D1D5DB"
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.eyeBtn} onPress={onToggleShow}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SaveButton({
  onPress,
  loading,
  label,
  icon,
  color = AMBER,
  disabled = false,
}: {
  onPress: () => void;
  loading: boolean;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.saveBtn, { backgroundColor: color }, (loading || disabled) && styles.saveBtnDisabled]}
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={16} color="#FFFFFF" />}
          <Text style={styles.saveBtnText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },

  // Inner tab bar
  innerTabBarScroll: {
    marginBottom: 20,
  },
  innerTabBar: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  innerTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  innerTabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  innerTabLabelActive: {
    color: '#FFFFFF',
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      web:     { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } as any,
      default: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },

  // Row layout
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrap: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#374151',
    backgroundColor: '#FAFAFA',
  },
  switchWrap: {
    alignItems: 'center',
    gap: 4,
  },
  switchLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },

  // Split preview
  splitPreview: {
    flex: 1,
    gap: 6,
    paddingLeft: 16,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  splitText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },

  // Info note
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
  },
  infoNoteText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
    lineHeight: 18,
  },

  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotGreen: { backgroundColor: '#059669' },
  statusDotRed:   { backgroundColor: '#DC2626' },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Stripe / secret fields
  stripeFieldsWrap: {
    gap: 14,
  },
  stripeField: {
    gap: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyeBtn: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
  },

  // Hint row
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  hintText: {
    fontSize: 12,
    color: '#6B7280',
  },

  // Feedback
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  feedbackSuccess: { backgroundColor: '#ECFDF5' },
  feedbackError:   { backgroundColor: '#FEF2F2' },
  feedbackText:    { fontSize: 13, fontWeight: '500' },
  feedbackTextSuccess: { color: '#065F46' },
  feedbackTextError:   { color: '#991B1B' },

  // Save button
  saveBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
