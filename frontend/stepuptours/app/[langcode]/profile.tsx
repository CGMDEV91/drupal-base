// app/[langcode]/profile.tsx
// User Profile page — auth-protected

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/auth.store';
import { useToursStore } from '../../stores/tours.store';
import { useLanguageStore } from '../../stores/language.store';
import { getUserTourActivities } from '../../services/tours.service';
import { updatePassword } from '../../services/user.service';
import BackButton from '../../components/layout/BackButton';
import type { TourActivity } from '../../types';

const AMBER = '#F59E0B';
const AMBER_DARK = '#D97706';
const CONTENT_MAX_WIDTH = 900;

// ── Stat card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  iconName: string;
  iconBg: string;
  iconColor: string;
  isDesktop: boolean;
}

function StatCard({ label, value, iconName, iconBg, iconColor, isDesktop }: StatCardProps) {
  return (
    <View style={[styles.statCard, isDesktop && styles.statCardDesktop]}>
      <View style={[styles.statIconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName as any} size={20} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Simple picker modal ───────────────────────────────────────────────────────
interface PickerItem {
  id: string;
  label: string;
}

interface PickerModalProps {
  visible: boolean;
  title: string;
  items: PickerItem[];
  selectedId: string;
  onSelect: (id: string, label: string) => void;
  onClose: () => void;
}

function PickerModal({ visible, title, items, selectedId, onSelect, onClose }: PickerModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color="#374151" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.pickerItem, item.id === selectedId && styles.pickerItemSelected]}
                onPress={() => {
                  onSelect(item.id, item.label);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    item.id === selectedId && styles.pickerItemTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
                {item.id === selectedId && (
                  <Ionicons name="checkmark" size={18} color={AMBER_DARK} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Profile screen ────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const countries = useToursStore((s) => s.countries);
  const fetchCountries = useToursStore((s) => s.fetchCountries);
  const languages = useLanguageStore((s) => s.languages);

  // ── Stats state ──────────────────────────────────────────────────────────
  const [activities, setActivities] = useState<TourActivity[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // ── Form state ───────────────────────────────────────────────────────────
  const [publicName, setPublicName] = useState(user?.publicName ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedLangCode, setSelectedLangCode] = useState(user?.preferredLanguage ?? 'en');
  const [selectedLangLabel, setSelectedLangLabel] = useState(
    languages.find((l) => l.id === (user?.preferredLanguage ?? 'en'))?.label ?? (user?.preferredLanguage ?? 'en')
  );
  const [selectedCountryId, setSelectedCountryId] = useState(user?.country?.id ?? '');
  const [selectedCountryLabel, setSelectedCountryLabel] = useState(user?.country?.name ?? '');

  // ── UI state ─────────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);

  // ── Redirect unauthenticated users ────────────────────────────────────────
  useEffect(() => {
    if (!user && !isAuthLoading) {
      router.replace(`/${langcode}` as any);
    }
  }, [user, isAuthLoading, langcode]);

  // ── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    setStatsLoading(true);
    try {
      const data = await getUserTourActivities(user.id);
      setActivities(data);
    } catch {
      // Non-critical — stats remain empty
    } finally {
      setStatsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Sync form when user changes (e.g. after save)
  useEffect(() => {
    if (user) {
      setPublicName(user.publicName);
      const langCode = user.preferredLanguage ?? 'en';
      setSelectedLangCode(langCode);
      setSelectedLangLabel(
        languages.find((l) => l.id === langCode)?.label ?? langCode
      );
      setSelectedCountryId(user.country?.id ?? '');
      setSelectedCountryLabel(user.country?.name ?? '');
    }
  }, [user, languages]);

  // ── Derived stats ────────────────────────────────────────────────────────
  const toursCompleted = activities.filter((a) => a.isCompleted).length;
  const ratingsGiven = activities.filter((a) => a.userRating !== null).length;
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(langcode ?? 'en', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!user) return;

    if (newPassword && newPassword !== confirmPassword) {
      setSaveError(t('profile.passwordMismatch'));
      setSaveSuccess(false);
      return;
    }

    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);

    try {
      await updateProfile({
        publicName,
        preferredLanguage: selectedLangCode,
        countryId: selectedCountryId || undefined,
      });

      if (newPassword) {
        await updatePassword(user.id, newPassword);
        setNewPassword('');
        setConfirmPassword('');
      }

      setSaveSuccess(true);

      if (Platform.OS !== 'web') {
        Alert.alert('', t('profile.saved'));
      }
    } catch (err: any) {
      setSaveError(err.message ?? 'Error saving profile');
    } finally {
      setIsSaving(false);
    }
  }, [
    user,
    publicName,
    newPassword,
    confirmPassword,
    selectedLangCode,
    selectedCountryId,
    updateProfile,
    t,
  ]);

  // ── Country picker items ─────────────────────────────────────────────────
  const countryItems: PickerItem[] = [
    { id: '', label: t('profile.selectCountry') },
    ...countries.map((c) => ({ id: c.id, label: c.name })),
  ];

  const langItems: PickerItem[] = languages.map((l) => ({
    id: l.id,
    label: l.label,
  }));

  // ── Auth loading or redirecting ──────────────────────────────────────────
  if (isAuthLoading || !user) {
    return (
      <View style={styles.authGateLoading}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  // ── Derived initials for avatar ───────────────────────────────────────────
  const displayName = user.publicName || user.username || '';
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Dark navy profile banner — dentro del scroll ── */}
        <View style={styles.profileBanner}>
          <View style={styles.bannerBackBtn}>
            <BackButton />
          </View>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <Text style={styles.bannerName}>{displayName}</Text>
          {user.email ? (
            <Text style={styles.bannerEmail}>{user.email}</Text>
          ) : null}
          <View style={styles.xpBadge}>
            <Text style={styles.xpBadgeText}>{user.experiencePoints} XP</Text>
          </View>
        </View>

        <View style={[styles.contentWrapper, { maxWidth: CONTENT_MAX_WIDTH }]}>

          {/* ── Stats section ─────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.stats')}</Text>
            {statsLoading ? (
              <ActivityIndicator size="small" color={AMBER} style={styles.statsLoader} />
            ) : (
              <View style={[styles.statsGrid, isDesktop && styles.statsGridDesktop]}>
                <StatCard
                  label={t('profile.stats.toursCompleted')}
                  value={toursCompleted}
                  iconName="trophy"
                  iconBg="#FEF3C7"
                  iconColor="#F59E0B"
                  isDesktop={isDesktop}
                />
                <StatCard
                  label={t('profile.stats.ratingsGiven')}
                  value={ratingsGiven}
                  iconName="location"
                  iconBg="#D1FAE5"
                  iconColor="#22C55E"
                  isDesktop={isDesktop}
                />
                <StatCard
                  label={t('profile.stats.memberSince')}
                  value={memberSince}
                  iconName="calendar"
                  iconBg="#EDE9FE"
                  iconColor="#8B5CF6"
                  isDesktop={isDesktop}
                />
                <StatCard
                  label={t('profile.stats.xp')}
                  value={user.experiencePoints}
                  iconName="globe"
                  iconBg="#DBEAFE"
                  iconColor="#3B82F6"
                  isDesktop={isDesktop}
                />
              </View>
            )}
          </View>

          {/* ── Edit section ──────────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.edit')}</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('profile.edit.publicName')}</Text>
              <TextInput
                style={styles.input}
                value={publicName}
                onChangeText={setPublicName}
                autoCapitalize="words"
                returnKeyType="done"
                placeholder={t('profile.edit.publicName')}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('profile.edit.newPassword')}</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                returnKeyType="next"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('profile.edit.confirmPassword')}</Text>
              <TextInput
                style={[
                  styles.input,
                  newPassword && confirmPassword && newPassword !== confirmPassword
                    ? styles.inputError
                    : null,
                ]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                returnKeyType="done"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('profile.edit.language')}</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setLangPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.pickerButtonText}>
                  {selectedLangLabel || t('profile.selectLanguage')}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('profile.edit.country')}</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setCountryPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.pickerButtonText}>
                  {selectedCountryLabel || t('profile.selectCountry')}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {saveError ? (
              <View style={styles.feedbackError}>
                <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                <Text style={styles.feedbackErrorText}>{saveError}</Text>
              </View>
            ) : null}

            {saveSuccess && Platform.OS === 'web' ? (
              <View style={styles.feedbackSuccess}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" />
                <Text style={styles.feedbackSuccessText}>{t('profile.saved')}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.btnAmber, styles.saveBtn, isSaving && styles.btnDisabled]}
              onPress={handleSave}
              activeOpacity={0.8}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.btnAmberText}>{t('profile.save')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modales fuera del scroll — son overlays */}
      <PickerModal
        visible={langPickerVisible}
        title={t('profile.edit.language')}
        items={langItems}
        selectedId={selectedLangCode}
        onSelect={(id, label) => {
          setSelectedLangCode(id);
          setSelectedLangLabel(label);
        }}
        onClose={() => setLangPickerVisible(false)}
      />

      <PickerModal
        visible={countryPickerVisible}
        title={t('profile.edit.country')}
        items={countryItems}
        selectedId={selectedCountryId}
        onSelect={(id, label) => {
          setSelectedCountryId(id);
          setSelectedCountryLabel(id ? label : '');
        }}
        onClose={() => setCountryPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // ── Dark navy profile banner ───────────────────────────────────────────────
  profileBanner: {
    backgroundColor: '#1E293B',
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
  },
  bannerBackBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  bannerName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  bannerEmail: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  xpBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
  },
  xpBadgeText: {
    color: '#D97706',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Auth loading ───────────────────────────────────────────────────────────
  authGateLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },

  // ── Scroll / layout ────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  // ── Sections ───────────────────────────────────────────────────────────────
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },

  // ── Stats grid ─────────────────────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statsGridDesktop: {
    gap: 16,
  },
  statsLoader: {
    marginVertical: 16,
  },

  // ── Stat card ──────────────────────────────────────────────────────────────
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  statCardDesktop: {
    minWidth: '22%',
  },
  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: AMBER_DARK,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },

  // ── Form fields ────────────────────────────────────────────────────────────
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
  inputError: {
    borderColor: '#EF4444',
  },
  pickerButton: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  pickerButtonText: {
    fontSize: 15,
    color: '#111827',
    flex: 1,
  },

  // ── Feedback ───────────────────────────────────────────────────────────────
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

  // ── Buttons ────────────────────────────────────────────────────────────────
  btnAmber: {
    backgroundColor: AMBER,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAmberText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    alignSelf: 'stretch',
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },

  // ── Picker modal ───────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  pickerItemSelected: {
    backgroundColor: '#FFFBEB',
  },
  pickerItemText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  pickerItemTextSelected: {
    color: AMBER_DARK,
    fontWeight: '700',
  },
});