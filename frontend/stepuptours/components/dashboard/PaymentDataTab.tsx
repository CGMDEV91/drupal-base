// components/dashboard/PaymentDataTab.tsx
// Displays and edits professional profile payment data

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  getProfessionalProfile,
  updateProfessionalProfile,
} from '../../services/dashboard.service';
import type { ProfessionalProfile } from '../../types';

const AMBER = '#F59E0B';

interface PaymentDataTabProps {
  userId: string;
}

export function PaymentDataTab({ userId }: PaymentDataTabProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProfessionalProfile(userId);
      setProfile(data);
      if (data) {
        setFullName(data.fullName);
        setTaxId(data.taxId);
        setAccountHolder(data.accountHolder);
        // iban and bic are not stored in the domain type; they come from Drupal
        // fields field_bank_iban / field_bank_bic — we start empty so user fills them
      }
    } catch (err: any) {
      setError(err.message ?? 'Error loading profile');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = useCallback(async () => {
    if (!profile) return;
    setSaveError(null);
    setSaveSuccess(false);
    setSaving(true);
    try {
      await updateProfessionalProfile(profile.id, {
        fullName,
        taxId,
        accountHolder,
        iban: iban.trim(),
        bic: bic.trim(),
      });
      setSaveSuccess(true);
      if (Platform.OS !== 'web') {
        Alert.alert('', t('dashboard.payment.saved'));
      }
    } catch (err: any) {
      setSaveError(err.message ?? 'Error saving payment data');
    } finally {
      setSaving(false);
    }
  }, [profile, fullName, taxId, accountHolder, iban, bic, t]);

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

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Ionicons name="person-circle-outline" size={56} color="#D1D5DB" />
        <Text style={styles.emptyText}>{t('dashboard.payment.noProfile')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('dashboard.payment.title')}</Text>

      <View style={[styles.form, isDesktop && styles.formDesktop]}>
        <FieldGroup label={t('dashboard.payment.fullName')}>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            returnKeyType="next"
            placeholder={t('dashboard.payment.fullName')}
            placeholderTextColor="#9CA3AF"
          />
        </FieldGroup>

        <FieldGroup label={t('dashboard.payment.taxId')}>
          <TextInput
            style={styles.input}
            value={taxId}
            onChangeText={setTaxId}
            autoCapitalize="characters"
            returnKeyType="next"
            placeholder="B12345678"
            placeholderTextColor="#9CA3AF"
          />
        </FieldGroup>

        <FieldGroup label={t('dashboard.payment.accountHolder')}>
          <TextInput
            style={styles.input}
            value={accountHolder}
            onChangeText={setAccountHolder}
            autoCapitalize="words"
            returnKeyType="next"
            placeholder={t('dashboard.payment.accountHolder')}
            placeholderTextColor="#9CA3AF"
          />
        </FieldGroup>

        <FieldGroup label={t('dashboard.payment.iban')}>
          <TextInput
            style={styles.input}
            value={iban}
            onChangeText={(v) => setIban(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="next"
            placeholder="ES12 3456 7890 1234 5678 9012"
            placeholderTextColor="#9CA3AF"
          />
        </FieldGroup>

        <FieldGroup label={t('dashboard.payment.bic')}>
          <TextInput
            style={styles.input}
            value={bic}
            onChangeText={(v) => setBic(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            placeholder="BSCHESMMXXX"
            placeholderTextColor="#9CA3AF"
          />
        </FieldGroup>

        {/* Feedback */}
        {saveError ? (
          <View style={styles.feedbackError}>
            <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
            <Text style={styles.feedbackErrorText}>{saveError}</Text>
          </View>
        ) : null}

        {saveSuccess && Platform.OS === 'web' ? (
          <View style={styles.feedbackSuccess}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" />
            <Text style={styles.feedbackSuccessText}>{t('dashboard.payment.saved')}</Text>
          </View>
        ) : null}

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>{t('dashboard.payment.save')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── FieldGroup helper ─────────────────────────────────────────────────────────

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
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
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
  },
  formDesktop: {},
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  feedbackError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  feedbackErrorText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
    flex: 1,
  },
  feedbackSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  feedbackSuccessText: {
    fontSize: 13,
    color: '#16A34A',
    fontWeight: '500',
    flex: 1,
  },
  saveBtn: {
    backgroundColor: AMBER,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
