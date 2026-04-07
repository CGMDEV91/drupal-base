// app/[langcode]/profile.tsx
// User Profile page — auth-protected

import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  Pressable,
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
import Footer from '../../components/layout/Footer';
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

// ── Picker ────────────────────────────────────────────────────────────────────
interface PickerItem {
  id: string;
  label: string;
}

interface PickerProps {
  visible: boolean;
  title: string;
  items: PickerItem[];
  selectedId: string;
  onSelect: (id: string, label: string) => void;
  onClose: () => void;
  isDesktop: boolean;
  anchorRef: React.RefObject<any>;
}

function Picker({ visible, title, items, selectedId, onSelect, onClose, isDesktop, anchorRef }: PickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPos, setDropdownPos] = useState<{
    x: number;
    y: number;
    width: number;
    listMaxHeight: number;
  } | null>(null);

  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      if (isDesktop && anchorRef.current) {
        anchorRef.current.measureInWindow((x: number, y: number, w: number, h: number) => {
          // Espacio disponible desde el borde inferior del botón hasta el fondo
          // de la ventana, con 16 px de margen de seguridad
          const screenHeight =
            Platform.OS === 'web' && typeof window !== 'undefined'
              ? window.innerHeight
              : 800;
          const dropdownTop = y + h + 4;
          const availableSpace = screenHeight - dropdownTop - 16;
          // searchBar ocupa ~64 px (padding + input 40 px)
          const listMaxHeight = Math.min(280, Math.max(80, availableSpace - 64));
          setDropdownPos({ x, y: dropdownTop, width: w, listMaxHeight });
        });
      }
    }
  }, [visible, isDesktop]);

  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const searchBar = (
    <View style={styles.searchWrapper}>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search..."
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </View>
  );

  const renderOptionList = (listMaxHeight: number) => (
    <FlatList
      data={filteredItems}
      keyExtractor={(item) => item.id}
      style={{ maxHeight: listMaxHeight }}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.pickerItem, item.id === selectedId && styles.pickerItemSelected]}
          onPress={() => { onSelect(item.id, item.label); onClose(); }}
          activeOpacity={0.7}
        >
          <Text style={[styles.pickerItemText, item.id === selectedId && styles.pickerItemTextSelected]}>
            {item.label}
          </Text>
          {item.id === selectedId && <Ionicons name="checkmark" size={18} color={AMBER_DARK} />}
        </TouchableOpacity>
      )}
    />
  );

  // ── Desktop: dropdown flotante anclado al botón, altura dinámica ──────────
  if (isDesktop) {
    if (!visible || !dropdownPos) return null;
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Pressable
            style={[
              styles.desktopDropdown,
              {
                left: dropdownPos.x,
                top: dropdownPos.y,
                width: dropdownPos.width,
              },
            ]}
          >
            {searchBar}
            {renderOptionList(dropdownPos.listMaxHeight)}
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // ── Mobile: pantalla completa con slide ───────────────────────────────────
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.mobileFullscreen}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color="#374151" />
          </TouchableOpacity>
        </View>
        {searchBar}
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.pickerItem, item.id === selectedId && styles.pickerItemSelected]}
              onPress={() => { onSelect(item.id, item.label); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickerItemText, item.id === selectedId && styles.pickerItemTextSelected]}>
                {item.label}
              </Text>
              {item.id === selectedId && <Ionicons name="checkmark" size={18} color={AMBER_DARK} />}
            </TouchableOpacity>
          )}
        />
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
  const fetchLanguages = useLanguageStore((s) => s.fetchLanguages);

  const [activities, setActivities] = useState<TourActivity[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const [publicName, setPublicName] = useState(user?.publicName ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedLangCode, setSelectedLangCode] = useState(user?.preferredLanguage ?? 'en');
  const [selectedLangLabel, setSelectedLangLabel] = useState(
    languages.find((l) => l.id === (user?.preferredLanguage ?? 'en'))?.name ?? (user?.preferredLanguage ?? 'en')
  );
  const [selectedCountryId, setSelectedCountryId] = useState(user?.country?.id ?? '');
  const [selectedCountryLabel, setSelectedCountryLabel] = useState(user?.country?.name ?? '');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);

  // Guard: evita router.replace antes de que el Root Layout esté montado
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  // Refs for anchor measurement
  const langButtonRef = useRef<any>(null);
  const countryButtonRef = useRef<any>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user && !isAuthLoading) {
      router.replace(`/${langcode}` as any);
    }
  }, [ready, user, isAuthLoading, langcode]);

  useEffect(() => {
    fetchCountries();
    if (languages.length === 0) {
      fetchLanguages();
    }
  }, [fetchCountries, fetchLanguages]);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    setStatsLoading(true);
    try {
      const data = await getUserTourActivities(user.id);
      setActivities(data);
    } catch {
      // Non-critical
    } finally {
      setStatsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (user) {
      setPublicName(user.publicName);
      const langCode = user.preferredLanguage ?? 'en';
      setSelectedLangCode(langCode);
      setSelectedLangLabel(languages.find((l) => l.id === langCode)?.name ?? langCode);
      setSelectedCountryId(user.country?.id ?? '');
      setSelectedCountryLabel(user.country?.name ?? '');
    }
  }, [user, languages]);

  const toursCompleted = activities.filter((a) => a.isCompleted).length;
  const ratingsGiven = activities.filter((a) => a.userRating !== null).length;
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(langcode ?? 'en', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    : '—';

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
  }, [user, publicName, newPassword, confirmPassword, selectedLangCode, selectedCountryId, updateProfile, t]);

  const countryItems: PickerItem[] = [
    { id: '', label: t('profile.selectCountry') },
    ...countries.map((c) => ({ id: c.id, label: c.name })),
  ];

  const langItems: PickerItem[] = languages.map((l) => ({ id: l.id, label: l.name }));

  if (isAuthLoading || !user) {
    return (
      <View style={styles.authGateLoading}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  const displayName = user.publicName || user.username || '';
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        overScrollMode="never"
      >
        {/* ── Dark navy profile banner ── */}
        <View style={styles.profileBanner}>
          <View style={styles.bannerBackBtn}>
            <BackButton />
          </View>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <Text style={styles.bannerName}>{displayName}</Text>
          {user.email ? <Text style={styles.bannerEmail}>{user.email}</Text> : null}
          <View style={styles.xpBadge}>
            <Text style={styles.xpBadgeText}>{user.experiencePoints} XP</Text>
          </View>
        </View>

        <View style={[styles.contentWrapper, { maxWidth: CONTENT_MAX_WIDTH }]}>
          {/* ── Stats section ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profile.stats')}</Text>
            {statsLoading ? (
              <ActivityIndicator size="small" color={AMBER} style={styles.statsLoader} />
            ) : (
              <View style={[styles.statsGrid, isDesktop && styles.statsGridDesktop]}>
                <StatCard label={t('profile.stats.toursCompleted')} value={toursCompleted} iconName="trophy" iconBg="#FEF3C7" iconColor="#F59E0B" isDesktop={isDesktop} />
                <StatCard label={t('profile.stats.ratingsGiven')} value={ratingsGiven} iconName="location" iconBg="#D1FAE5" iconColor="#22C55E" isDesktop={isDesktop} />
                <StatCard label={t('profile.stats.memberSince')} value={memberSince} iconName="calendar" iconBg="#EDE9FE" iconColor="#8B5CF6" isDesktop={isDesktop} />
                <StatCard label={t('profile.stats.xp')} value={user.experiencePoints} iconName="globe" iconBg="#DBEAFE" iconColor="#3B82F6" isDesktop={isDesktop} />
              </View>
            )}
          </View>

          {/* ── Edit section ── */}
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
                  newPassword && confirmPassword && newPassword !== confirmPassword ? styles.inputError : null,
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
                ref={langButtonRef}
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
                ref={countryButtonRef}
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
        <Footer />
      </ScrollView>

      <Picker
        visible={langPickerVisible}
        title={t('profile.edit.language')}
        items={langItems}
        selectedId={selectedLangCode}
        onSelect={(id, label) => { setSelectedLangCode(id); setSelectedLangLabel(label); }}
        onClose={() => setLangPickerVisible(false)}
        isDesktop={isDesktop}
        anchorRef={langButtonRef}
      />

      <Picker
        visible={countryPickerVisible}
        title={t('profile.edit.country')}
        items={countryItems}
        selectedId={selectedCountryId}
        onSelect={(id, label) => { setSelectedCountryId(id); setSelectedCountryLabel(id ? label : ''); }}
        onClose={() => setCountryPickerVisible(false)}
        isDesktop={isDesktop}
        anchorRef={countryButtonRef}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    ...(Platform.OS === 'web' ? { height: '100vh' as any, overflow: 'hidden' as any } : {}),
  },
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
  authGateLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  contentWrapper: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
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
    fontSize: 16,
    fontWeight: '600',
    color: AMBER_DARK,
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
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
  // ── Mobile fullscreen ──────────────────────────────────────────────────────
  mobileFullscreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 52 : 28,
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
  // ── Desktop dropdown ───────────────────────────────────────────────────────
  desktopDropdown: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 32px rgba(0,0,0,0.14)' } as any)
      : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 20,
        elevation: 12,
      }),
  },
  // ── Shared search ──────────────────────────────────────────────────────────
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    height: 40,
    paddingHorizontal: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    height: 40,
  },
  // ── Shared picker items ────────────────────────────────────────────────────
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
