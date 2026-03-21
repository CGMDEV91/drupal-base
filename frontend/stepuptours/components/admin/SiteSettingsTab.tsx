// components/admin/SiteSettingsTab.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
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

const NETWORKS = [
  { key: 'facebook' as const, icon: 'logo-facebook' as const, label: 'Facebook' },
  { key: 'twitter' as const, icon: 'logo-twitter' as const, label: 'Twitter / X' },
  { key: 'instagram' as const, icon: 'logo-instagram' as const, label: 'Instagram' },
];

const DEFAULT_SOCIAL: SocialState = {
  facebook: { url: '', visible: true },
  twitter: { url: '', visible: true },
  instagram: { url: '', visible: true },
};

export function SiteSettingsTab() {
  const { t } = useTranslation();
  const [social, setSocial] = useState<SocialState>(DEFAULT_SOCIAL);
  const [payment, setPayment] = useState<PaymentState>({ platformRevenuePercentage: 20, stripeConfigured: false });
  const [stripe, setStripe] = useState<StripeFormState>({
    publishableKey: '',
    secretKey: '',
    webhookSecret: '',
    secretKeyConfigured: false,
    webhookConfigured: false,
    showSecretKey: false,
    showWebhookSecret: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStripe, setSavingStripe] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [stripeFeedback, setStripeFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    getSiteSettings()
      .then((data: any) => {
        if (data.socialLinks) {
          setSocial({
            facebook: data.socialLinks.facebook ?? DEFAULT_SOCIAL.facebook,
            twitter: data.socialLinks.twitter ?? DEFAULT_SOCIAL.twitter,
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
            publishableKey: data.stripeSettings.publishableKey ?? '',
            secretKeyConfigured: data.stripeSettings.secretKeyConfigured ?? false,
            webhookConfigured: data.stripeSettings.webhookConfigured ?? false,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Social + Revenue Split handlers ────────────────────────────────────────

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

  // ── Stripe handlers ─────────────────────────────────────────────────────────

  const handleSaveStripe = async () => {
    setSavingStripe(true);
    setStripeFeedback(null);
    try {
      const payload: Record<string, string> = {};
      if (stripe.publishableKey.trim()) payload.publishableKey = stripe.publishableKey.trim();
      if (stripe.secretKey.trim()) payload.secretKey = stripe.secretKey.trim();
      if (stripe.webhookSecret.trim()) payload.webhookSecret = stripe.webhookSecret.trim();

      const updated = await updateStripeKeys(payload);

      // Update state with the response
      if (updated.stripeSettings) {
        setStripe((prev) => ({
          ...prev,
          publishableKey: updated.stripeSettings!.publishableKey ?? prev.publishableKey,
          secretKeyConfigured: updated.stripeSettings!.secretKeyConfigured,
          webhookConfigured: updated.stripeSettings!.webhookConfigured,
          secretKey: '',   // clear after save — don't keep in state
          webhookSecret: '',
        }));
      }
      if (updated.paymentSettings) {
        setPayment((prev) => ({ ...prev, stripeConfigured: updated.paymentSettings!.stripeConfigured }));
      }

      // Reset cached Stripe.js promise so next payment uses the new key
      resetStripePromise();
      setStripeFeedback({ type: 'success', message: t('admin.settings.stripeSaved') });
    } catch {
      setStripeFeedback({ type: 'error', message: t('admin.settings.error') });
    } finally {
      setSavingStripe(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  return (
    <View>
      {/* ── Social Links Card ─────────────────────────────────────────────── */}
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

      {/* ── Revenue Split Card ────────────────────────────────────────────── */}
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

      {/* Feedback + save for social + revenue */}
      {feedback && <FeedbackBanner feedback={feedback} />}
      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.saveBtnText}>{t('admin.settings.save')}</Text>
        )}
      </TouchableOpacity>

      {/* ── Stripe Configuration Card ─────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="card-outline" size={20} color="#6772E5" />
          <Text style={styles.cardTitle}>{t('admin.settings.stripeConfig')}</Text>
          <View style={styles.stripeBadge}>
            <View style={[styles.statusDot, payment.stripeConfigured ? styles.statusDotGreen : styles.statusDotRed]} />
            <Text style={[styles.stripeStatusText, { color: payment.stripeConfigured ? '#059669' : '#DC2626' }]}>
              {payment.stripeConfigured ? t('admin.settings.stripeConnected') : t('admin.settings.stripeNotConfigured')}
            </Text>
          </View>
        </View>

        <View style={styles.infoNote}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#6B7280" />
          <Text style={styles.infoNoteText}>{t('admin.settings.stripeKeysNote')}</Text>
        </View>

        <View style={styles.stripeFieldsWrap}>
          {/* Publishable Key */}
          <View style={styles.stripeField}>
            <Text style={styles.inputLabel}>{t('admin.settings.stripePublishableKey')}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={stripe.publishableKey}
                onChangeText={(v) => setStripe((prev) => ({ ...prev, publishableKey: v }))}
                placeholder="pk_test_..."
                placeholderTextColor="#D1D5DB"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Secret Key */}
          <View style={styles.stripeField}>
            <Text style={styles.inputLabel}>
              {t('admin.settings.stripeSecretKey')}
              {stripe.secretKeyConfigured && (
                <Text style={styles.configuredBadge}> ✓ {t('admin.settings.keySet')}</Text>
              )}
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={stripe.secretKey}
                onChangeText={(v) => setStripe((prev) => ({ ...prev, secretKey: v }))}
                placeholder={stripe.secretKeyConfigured ? '••••••••••••••••••••' : 'sk_test_...'}
                placeholderTextColor="#D1D5DB"
                secureTextEntry={!stripe.showSecretKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setStripe((prev) => ({ ...prev, showSecretKey: !prev.showSecretKey }))}
              >
                <Ionicons
                  name={stripe.showSecretKey ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Webhook Secret */}
          <View style={styles.stripeField}>
            <Text style={styles.inputLabel}>
              {t('admin.settings.stripeWebhookSecret')}
              {stripe.webhookConfigured && (
                <Text style={styles.configuredBadge}> ✓ {t('admin.settings.keySet')}</Text>
              )}
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={stripe.webhookSecret}
                onChangeText={(v) => setStripe((prev) => ({ ...prev, webhookSecret: v }))}
                placeholder={stripe.webhookConfigured ? '••••••••••••••••••••' : 'whsec_...'}
                placeholderTextColor="#D1D5DB"
                secureTextEntry={!stripe.showWebhookSecret}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setStripe((prev) => ({ ...prev, showWebhookSecret: !prev.showWebhookSecret }))}
              >
                <Ionicons
                  name={stripe.showWebhookSecret ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.stripeHelp}>
          <Ionicons name="open-outline" size={14} color="#6B7280" />
          <Text style={styles.stripeHelpText}>{t('admin.settings.stripeDashboardHint')}</Text>
        </View>
      </View>

      {/* Feedback + save for Stripe keys */}
      {stripeFeedback && <FeedbackBanner feedback={stripeFeedback} />}
      <TouchableOpacity
        style={[styles.saveBtn, styles.saveBtnStripe, savingStripe && styles.saveBtnDisabled]}
        onPress={handleSaveStripe}
        disabled={savingStripe}
        activeOpacity={0.8}
      >
        {savingStripe ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="card-outline" size={16} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>{t('admin.settings.saveStripeKeys')}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ── Feedback Banner ───────────────────────────────────────────────────────────

function FeedbackBanner({
  feedback,
}: {
  feedback: { type: 'success' | 'error'; message: string };
}) {
  return (
    <View
      style={[
        styles.feedbackBanner,
        feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
      ]}
    >
      <Ionicons
        name={feedback.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
        size={18}
        color={feedback.type === 'success' ? '#065F46' : '#991B1B'}
      />
      <Text
        style={[
          styles.feedbackText,
          feedback.type === 'success' ? styles.feedbackTextSuccess : styles.feedbackTextError,
        ]}
      >
        {feedback.message}
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } as any,
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

  // Stripe card
  stripeBadge: {
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
  statusDotRed: { backgroundColor: '#DC2626' },
  stripeStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stripeFieldsWrap: {
    gap: 14,
    marginTop: 16,
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
  configuredBadge: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
    textTransform: 'none',
  },
  stripeHelp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  stripeHelpText: {
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
  feedbackError: { backgroundColor: '#FEF2F2' },
  feedbackText: { fontSize: 13, fontWeight: '500' },
  feedbackTextSuccess: { color: '#065F46' },
  feedbackTextError: { color: '#991B1B' },

  // Save buttons
  saveBtn: {
    backgroundColor: AMBER,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnStripe: {
    backgroundColor: '#6772E5',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
