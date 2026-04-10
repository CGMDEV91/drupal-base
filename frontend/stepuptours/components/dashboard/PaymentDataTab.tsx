// components/dashboard/PaymentDataTab.tsx
// Billing / payment data form for professional profile

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
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  getProfessionalProfile,
  createProfessionalProfile,
  updateProfessionalProfile,
} from '../../services/dashboard.service';
import type { ProfessionalProfile } from '../../types';

const AMBER = '#F59E0B';

interface PaymentDataTabProps {
  userId: string;
}

// ── Section header inside the form ────────────────────────────────────────────
function SectionHeader({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={16} color={AMBER} />
      <Text style={styles.sectionHeaderText}>{label}</Text>
    </View>
  );
}

// ── Field group ───────────────────────────────────────────────────────────────
function FieldGroup({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={styles.fieldRequired}> *</Text>}
      </Text>
      {children}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function PaymentDataTab({ userId }: PaymentDataTabProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Personal / fiscal fields
  const [fullName, setFullName] = useState('');
  const [taxId, setTaxId] = useState('');

  // ── Bank fields
  const [accountHolder, setAccountHolder] = useState('');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');

  // ── Address fields
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [locality, setLocality] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [countryCode, setCountryCode] = useState('ES');
  const [administrativeArea, setAdministrativeArea] = useState('');

  // ── Save state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Load existing profile
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
        setIban(data.iban);
        setBic(data.bic);
        if (data.address) {
          setAddressLine1(data.address.addressLine1);
          setAddressLine2(data.address.addressLine2);
          setLocality(data.address.locality);
          setPostalCode(data.address.postalCode);
          setCountryCode(data.address.countryCode || 'ES');
          setAdministrativeArea(data.address.administrativeArea);
        }
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

  // ── Save handler: create if no profile, otherwise patch
  const handleSave = useCallback(async () => {
    setSaveError(null);
    setSaveSuccess(false);
    setSaving(true);

    const updates = {
      fullName,
      taxId,
      accountHolder,
      iban: iban.replace(/\s/g, '').toUpperCase(),
      bic: bic.trim().toUpperCase(),
      addressLine1,
      addressLine2,
      locality,
      postalCode,
      countryCode: countryCode.toUpperCase(),
      administrativeArea,
    };

    try {
      if (profile) {
        await updateProfessionalProfile(profile.id, updates);
      } else {
        await createProfessionalProfile(userId, updates);
        // Reload to get the newly created profile id
        await loadProfile();
      }
      setSaveSuccess(true);
      if (Platform.OS !== 'web') {
        Alert.alert('', t('dashboard.payment.saved'));
      }
    } catch (err: any) {
      setSaveError(err.message ?? 'Error saving payment data');
    } finally {
      setSaving(false);
    }
  }, [
    profile,
    userId,
    fullName,
    taxId,
    accountHolder,
    iban,
    bic,
    addressLine1,
    addressLine2,
    locality,
    postalCode,
    countryCode,
    administrativeArea,
    t,
    loadProfile,
  ]);

  // ── Loading
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  // ── Error
  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadProfile}>
          <Text style={styles.retryBtnText}>{t('common.retry', 'Reintentar')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const twoCol = isDesktop;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.titleRow}>
        <Ionicons name="card-outline" size={20} color={AMBER} />
        <Text style={styles.pageTitle}>{t('dashboard.payment.title', 'Datos de pago')}</Text>
        {!profile && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>{t('dashboard.payment.new', 'Nuevo')}</Text>
          </View>
        )}
      </View>

      <Text style={styles.pageSubtitle}>
        {t(
          'dashboard.payment.subtitle',
          'Rellena tus datos fiscales y bancarios para recibir donaciones.'
        )}
      </Text>

      {/* ── Block 1: Datos personales / fiscales ─────────────────────────── */}
      <View style={styles.block}>
        <SectionHeader icon="person-outline" label={t('dashboard.payment.sectionPersonal', 'Datos personales')} />
        <View style={[styles.row, twoCol && styles.rowTwoCol]}>
          <FieldGroup label={t('dashboard.payment.fullName', 'Nombre completo')} required>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              returnKeyType="next"
              placeholder="María García López"
              placeholderTextColor="#9CA3AF"
            />
          </FieldGroup>
          <FieldGroup label={t('dashboard.payment.taxId', 'NIF / CIF')} required>
            <TextInput
              style={styles.input}
              value={taxId}
              onChangeText={(v) => setTaxId(v.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="next"
              placeholder="B12345678"
              placeholderTextColor="#9CA3AF"
            />
          </FieldGroup>
        </View>
      </View>

      {/* ── Block 2: Dirección de facturación ────────────────────────────── */}
      <View style={styles.block}>
        <SectionHeader icon="location-outline" label={t('dashboard.payment.sectionAddress', 'Dirección de facturación')} />

        <FieldGroup label={t('dashboard.payment.addressLine1', 'Calle y número')} required>
          <TextInput
            style={styles.input}
            value={addressLine1}
            onChangeText={setAddressLine1}
            autoCapitalize="sentences"
            returnKeyType="next"
            placeholder="Calle Gran Vía, 45"
            placeholderTextColor="#9CA3AF"
          />
        </FieldGroup>

        <FieldGroup label={t('dashboard.payment.addressLine2', 'Piso / apartamento')}>
          <TextInput
            style={styles.input}
            value={addressLine2}
            onChangeText={setAddressLine2}
            autoCapitalize="sentences"
            returnKeyType="next"
            placeholder="3º B"
            placeholderTextColor="#9CA3AF"
          />
        </FieldGroup>

        <View style={[styles.row, twoCol && styles.rowTwoCol]}>
          <FieldGroup label={t('dashboard.payment.postalCode', 'Código postal')} required>
            <TextInput
              style={styles.input}
              value={postalCode}
              onChangeText={setPostalCode}
              keyboardType="numeric"
              returnKeyType="next"
              placeholder="28001"
              placeholderTextColor="#9CA3AF"
            />
          </FieldGroup>
          <FieldGroup label={t('dashboard.payment.locality', 'Ciudad')} required>
            <TextInput
              style={styles.input}
              value={locality}
              onChangeText={setLocality}
              autoCapitalize="words"
              returnKeyType="next"
              placeholder="Madrid"
              placeholderTextColor="#9CA3AF"
            />
          </FieldGroup>
        </View>

        <View style={[styles.row, twoCol && styles.rowTwoCol]}>
          <FieldGroup label={t('dashboard.payment.administrativeArea', 'Provincia / Estado')}>
            <TextInput
              style={styles.input}
              value={administrativeArea}
              onChangeText={setAdministrativeArea}
              autoCapitalize="words"
              returnKeyType="next"
              placeholder="Madrid"
              placeholderTextColor="#9CA3AF"
            />
          </FieldGroup>
          <FieldGroup label={t('dashboard.payment.countryCode', 'País (código ISO)')} required>
            <TextInput
              style={styles.input}
              value={countryCode}
              onChangeText={(v) => setCountryCode(v.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={2}
              returnKeyType="next"
              placeholder="ES"
              placeholderTextColor="#9CA3AF"
            />
          </FieldGroup>
        </View>
      </View>

      {/* ── Block 3: Datos bancarios ──────────────────────────────────────── */}
      <View style={styles.block}>
        <SectionHeader icon="business-outline" label={t('dashboard.payment.sectionBank', 'Datos bancarios')} />

        <FieldGroup label={t('dashboard.payment.accountHolder', 'Titular de la cuenta')} required>
          <TextInput
            style={styles.input}
            value={accountHolder}
            onChangeText={setAccountHolder}
            autoCapitalize="words"
            returnKeyType="next"
            placeholder="María García López"
            placeholderTextColor="#9CA3AF"
          />
        </FieldGroup>

        <FieldGroup label={t('dashboard.payment.iban', 'IBAN')} required>
          <TextInput
            style={[styles.input, styles.inputMono]}
            value={iban}
            onChangeText={(v) => setIban(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="next"
            placeholder="ES12 3456 7890 1234 5678 9012"
            placeholderTextColor="#9CA3AF"
          />
        </FieldGroup>

        <FieldGroup label={t('dashboard.payment.bic', 'BIC / SWIFT')}>
          <TextInput
            style={[styles.input, styles.inputMono]}
            value={bic}
            onChangeText={(v) => setBic(v.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            placeholder="BSCHESMMXXX"
            placeholderTextColor="#9CA3AF"
          />
        </FieldGroup>
      </View>

      {/* ── Feedback ─────────────────────────────────────────────────────── */}
      {saveError ? (
        <View style={styles.feedbackError}>
          <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
          <Text style={styles.feedbackErrorText}>{saveError}</Text>
        </View>
      ) : null}

      {saveSuccess && Platform.OS === 'web' ? (
        <View style={styles.feedbackSuccess}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" />
          <Text style={styles.feedbackSuccessText}>
            {t('dashboard.payment.saved', 'Datos guardados correctamente')}
          </Text>
        </View>
      ) : null}

      {/* ── Save button ───────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        activeOpacity={0.85}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="save-outline" size={18} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>
              {profile
                ? t('dashboard.payment.save', 'Guardar cambios')
                : t('dashboard.payment.create', 'Crear perfil de pago')}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 32,
  },
  centered: {
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
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },

  // ── Page title
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  pageTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  newBadge: {
    backgroundColor: '#D1FAE5',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  newBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 20,
  },

  // ── Blocks
  block: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Rows (2-column on desktop)
  row: {
    gap: 0,
  },
  rowTwoCol: {
    flexDirection: 'row',
    gap: 12,
  },

  // ── Field group
  fieldGroup: {
    marginBottom: 12,
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 5,
  },
  fieldRequired: {
    color: '#EF4444',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  inputMono: {
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
    letterSpacing: 0.5,
  },

  // ── Feedback
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

  // ── Save button
  saveBtn: {
    backgroundColor: AMBER,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
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
