// app/[langcode]/dashboard/create-tour.tsx
// Create Tour page — professional role only

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../stores/auth.store';
import { useToursStore } from '../../../stores/tours.store';
import { useLanguageStore } from '../../../stores/language.store';
import { createTour, createTourStep, getActiveSubscription } from '../../../services/dashboard.service';
import PageBanner from '../../../components/layout/PageBanner';
import type { Subscription } from '../../../types';

const AMBER = '#F59E0B';
const CONTENT_MAX_WIDTH = 900;

interface StepEntry {
  key: string;
  title: string;
  description: string;
  lat: string;
  lon: string;
  duration: string;
}

function makeKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function CreateTourScreen() {
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const isProfessional = user?.roles?.includes('professional');

  useEffect(() => {
    if (!isAuthLoading && (!user || !isProfessional)) {
      router.replace(`/${langcode}` as any);
    }
  }, [user, isAuthLoading, isProfessional, langcode]);

  // ── Tour basic info ──────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');

  // ── Desktop dropdown ─────────────────────────────────────────────────────
  const cityBtnRef = useRef<View>(null);
  const langBtnRef = useRef<View>(null);
  const [ddConfig, setDdConfig] = useState<{
    type: 'city' | 'lang';
    x: number;
    y: number;
    minWidth: number;
  } | null>(null);
  const [ddSearch, setDdSearch] = useState('');

  const openPicker = useCallback(
    (type: 'city' | 'lang') => {
      if (!isDesktop) {
        if (type === 'city') setCityPickerVisible(true);
        else setLangPickerVisible(true);
        return;
      }
      const ref = type === 'city' ? cityBtnRef : langBtnRef;
      ref.current?.measureInWindow((x, y, w, h) => {
        setDdSearch('');
        setDdConfig({ type, x, y: y + h + 4, minWidth: Math.max(w, 220) });
      });
    },
    [isDesktop]
  );

  const closeDd = useCallback(() => setDdConfig(null), []);

  // ── City picker ──────────────────────────────────────────────────────────
  const [cityId, setCityId] = useState('');
  const [cityLabel, setCityLabel] = useState('');
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [citySearch, setCitySearch] = useState('');

  const { cities, fetchCities } = useToursStore();

  useEffect(() => {
    if (cities.length === 0) {
      fetchCities();
    }
  }, []);

  const filteredCities = cities.filter((c) =>
    c.name.toLowerCase().includes(citySearch.toLowerCase())
  );

  // ── Language picker ──────────────────────────────────────────────────────
  const [languageCode, setLanguageCode] = useState('es');
  const [languageLabel, setLanguageLabel] = useState('');
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [langSearch, setLangSearch] = useState('');

  const { languages, fetchLanguages } = useLanguageStore();

  useEffect(() => {
    if (languages.length === 0) {
      fetchLanguages();
    }
  }, []);

  const filteredLanguages = languages.filter((l) =>
    l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
    l.id.toLowerCase().includes(langSearch.toLowerCase())
  );

  // ── Tour steps ──────────────────────────────────────────────────────────
  const [steps, setSteps] = useState<StepEntry[]>([]);

  const addStep = useCallback(() => {
    setSteps((prev) => [
      ...prev,
      { key: makeKey(), title: '', description: '', lat: '', lon: '', duration: '' },
    ]);
  }, []);

  const removeStep = useCallback((key: string) => {
    setSteps((prev) => prev.filter((s) => s.key !== key));
  }, []);

  const updateStep = useCallback((key: string, field: keyof StepEntry, value: string) => {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)));
  }, []);

  const moveStepUp = useCallback((index: number) => {
    if (index === 0) return;
    setSteps((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const moveStepDown = useCallback((index: number) => {
    setSteps((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index + 1], next[index]] = [next[index], next[index + 1]];
      return next;
    });
  }, []);

  // ── Subscription / featured businesses ──────────────────────────────────
  const [subscription, setSubscription] = useState<Subscription | null | undefined>(undefined);

  useEffect(() => {
    if (user?.id) {
      getActiveSubscription(user.id)
        .then((sub) => setSubscription(sub))
        .catch(() => setSubscription(null));
    }
  }, [user?.id]);

  const tourBusinessSlots = subscription ? 3 : 1;
  const stepBusinessSlots = subscription ? 5 : 1;

  const [tourBusinesses, setTourBusinesses] = useState<string[]>(['', '', '']);
  const [stepBusinesses, setStepBusinesses] = useState<Record<string, string[]>>({});

  const getStepBusinesses = useCallback(
    (key: string): string[] => stepBusinesses[key] ?? Array(stepBusinessSlots).fill(''),
    [stepBusinesses, stepBusinessSlots]
  );

  const updateStepBusiness = useCallback(
    (stepKey: string, slotIndex: number, value: string) => {
      setStepBusinesses((prev) => {
        const current = prev[stepKey] ?? Array(stepBusinessSlots).fill('');
        const next = [...current];
        next[slotIndex] = value;
        return { ...prev, [stepKey]: next };
      });
    },
    [stepBusinessSlots]
  );

  // ── Save ─────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setValidationError(null);

    if (!title.trim()) {
      setValidationError(t('createTour.validation.titleRequired'));
      return;
    }
    if (steps.length === 0) {
      setValidationError(t('createTour.validation.stepsRequired'));
      return;
    }
    const firstEmptyStep = steps.findIndex((s) => !s.title.trim());
    if (firstEmptyStep !== -1) {
      setValidationError(t('createTour.validation.stepTitleRequired', { order: firstEmptyStep + 1 }));
      return;
    }

    setSaving(true);
    try {
      const tour = await createTour({
        title: title.trim(),
        description: description.trim(),
        duration: parseInt(duration, 10) || 0,
        cityId: cityId || undefined,
      });

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await createTourStep(tour.id, {
          title: step.title.trim(),
          description: step.description.trim(),
          order: i + 1,
        });
      }

      router.replace(`/${langcode}/dashboard` as any);
    } catch (err: any) {
      const message = err.message ?? t('createTour.error.generic');
      if (Platform.OS !== 'web') {
        Alert.alert(t('createTour.error.title'), message);
      } else {
        setValidationError(message);
      }
    } finally {
      setSaving(false);
    }
  }, [title, description, duration, cityId, steps, langcode, router, t]);

  if (isAuthLoading || !user || !isProfessional) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  const contentStyle = {
    paddingHorizontal: 16,
    paddingTop: 24,
    ...(isDesktop ? { maxWidth: CONTENT_MAX_WIDTH, width: '100%' as const, alignSelf: 'center' as const } : {}),
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PageBanner
          icon="add-circle-outline"
          iconBgColor={AMBER}
          title={t('createTour.title')}
          subtitle={t('createTour.subtitle')}
          showBack
        />
        <View style={contentStyle}>

          {/* Section 1: Basic Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('createTour.section.basicInfo')}</Text>

            <Text style={styles.label}>
              {t('createTour.field.title')} <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={t('createTour.placeholder.title')}
              placeholderTextColor="#9CA3AF"
              maxLength={200}
            />

            <Text style={styles.label}>{t('createTour.field.description')}</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder={t('createTour.placeholder.description')}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.row}>
              <View style={styles.rowField}>
                <Text style={styles.label}>{t('createTour.field.city')}</Text>
                <View ref={cityBtnRef} collapsable={false}>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => openPicker('city')}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: cityLabel ? '#111827' : '#9CA3AF', fontSize: 15 }}>
                      {cityLabel || t('createTour.placeholder.city')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.rowField}>
                <Text style={styles.label}>{t('createTour.field.duration')}</Text>
                <TextInput
                  style={styles.input}
                  value={duration}
                  onChangeText={(v) => setDuration(v.replace(/[^0-9]/g, ''))}
                  placeholder="60"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.rowField}>
                <Text style={styles.label}>{t('createTour.field.language')}</Text>
                <View ref={langBtnRef} collapsable={false}>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => openPicker('lang')}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: languageLabel ? '#111827' : '#9CA3AF', fontSize: 15 }}>
                      {languageLabel || languageCode}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* Section 2: Steps */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('createTour.section.steps')}</Text>
              <TouchableOpacity style={styles.addStepBtn} onPress={addStep} activeOpacity={0.85}>
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text style={styles.addStepBtnText}>{t('createTour.action.addStep')}</Text>
              </TouchableOpacity>
            </View>

            {steps.length === 0 ? (
              <View style={styles.emptySteps}>
                <Ionicons name="footsteps-outline" size={40} color="#D1D5DB" />
                <Text style={styles.emptyStepsText}>{t('createTour.steps.empty')}</Text>
              </View>
            ) : (
              steps.map((step, index) => (
                <View key={step.key} style={styles.stepCard}>
                  <View style={styles.stepHeader}>
                    <View style={styles.stepOrderBadge}>
                      <Text style={styles.stepOrderText}>{index + 1}</Text>
                    </View>
                    <View style={styles.stepActions}>
                      <TouchableOpacity
                        style={styles.stepActionBtn}
                        onPress={() => moveStepUp(index)}
                        disabled={index === 0}
                      >
                        <Ionicons name="chevron-up" size={16} color={index === 0 ? '#D1D5DB' : '#6B7280'} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.stepActionBtn}
                        onPress={() => moveStepDown(index)}
                        disabled={index === steps.length - 1}
                      >
                        <Ionicons name="chevron-down" size={16} color={index === steps.length - 1 ? '#D1D5DB' : '#6B7280'} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.stepDeleteBtn} onPress={() => removeStep(step.key)}>
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.label}>
                    {t('createTour.field.stepTitle')} <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={step.title}
                    onChangeText={(v) => updateStep(step.key, 'title', v)}
                    placeholder={t('createTour.placeholder.stepTitle')}
                    placeholderTextColor="#9CA3AF"
                  />

                  <Text style={styles.label}>{t('createTour.field.stepDescription')}</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    value={step.description}
                    onChangeText={(v) => updateStep(step.key, 'description', v)}
                    placeholder={t('createTour.placeholder.stepDescription')}
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />

                  <View style={styles.row}>
                    <View style={styles.rowField}>
                      <Text style={styles.label}>{t('createTour.field.lat')}</Text>
                      <TextInput
                        style={styles.input}
                        value={step.lat}
                        onChangeText={(v) => updateStep(step.key, 'lat', v)}
                        placeholder="41.3851"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.rowField}>
                      <Text style={styles.label}>{t('createTour.field.lon')}</Text>
                      <TextInput
                        style={styles.input}
                        value={step.lon}
                        onChangeText={(v) => updateStep(step.key, 'lon', v)}
                        placeholder="2.1734"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.rowField}>
                      <Text style={styles.label}>{t('createTour.field.stepDuration')}</Text>
                      <TextInput
                        style={styles.input}
                        value={step.duration}
                        onChangeText={(v) => updateStep(step.key, 'duration', v.replace(/[^0-9]/g, ''))}
                        placeholder="15"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  {Array.from({ length: stepBusinessSlots }).map((_, slotIdx) => (
                    <View key={slotIdx}>
                      <Text style={styles.label}>
                        {t('createTour.field.stepBusiness', { slot: slotIdx + 1 })}
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={getStepBusinesses(step.key)[slotIdx] ?? ''}
                        onChangeText={(v) => updateStepBusiness(step.key, slotIdx, v)}
                        placeholder={t('createTour.placeholder.businessId')}
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="none"
                      />
                    </View>
                  ))}
                </View>
              ))
            )}
          </View>

          {/* Section 3: Tour-level Featured Businesses */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('createTour.section.businesses')}</Text>
            {subscription === undefined ? (
              <ActivityIndicator size="small" color={AMBER} style={{ marginVertical: 12 }} />
            ) : (
              <>
                <Text style={styles.subscriptionNote}>
                  {subscription
                    ? t('createTour.businesses.withSubscription', { max: tourBusinessSlots })
                    : t('createTour.businesses.noSubscription')}
                </Text>
                {Array.from({ length: tourBusinessSlots }).map((_, idx) => (
                  <View key={idx}>
                    <Text style={styles.label}>
                      {t('createTour.field.tourBusiness', { slot: idx + 1 })}
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={tourBusinesses[idx] ?? ''}
                      onChangeText={(v) =>
                        setTourBusinesses((prev) => {
                          const next = [...prev];
                          next[idx] = v;
                          return next;
                        })
                      }
                      placeholder={t('createTour.placeholder.businessId')}
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                    />
                  </View>
                ))}
              </>
            )}
          </View>

          {validationError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
              <Text style={styles.errorBannerText}>{validationError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>{t('createTour.action.save')}</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>

      {/* Mobile bottom-sheet pickers */}
      {!isDesktop && (
        <>
          <Modal
            visible={cityPickerVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setCityPickerVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <Pressable style={styles.modalBackdrop} onPress={() => setCityPickerVisible(false)} />
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalHeaderTitle}>{t('createTour.field.city')}</Text>
                  <TouchableOpacity onPress={() => setCityPickerVisible(false)} activeOpacity={0.7}>
                    <Ionicons name="close" size={22} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.pickerSearch}
                  value={citySearch}
                  onChangeText={setCitySearch}
                  placeholder={t('createTour.placeholder.city')}
                  placeholderTextColor="#9CA3AF"
                  autoFocus
                  {...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {})}
                />
                <FlatList
                  data={[{ id: '', name: t('createTour.placeholder.city') }, ...filteredCities]}
                  keyExtractor={(item) => item.id || '__clear__'}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.pickerItem}
                      onPress={() => {
                        setCityId(item.id);
                        setCityLabel(item.id ? item.name : '');
                        setCityPickerVisible(false);
                        setCitySearch('');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pickerItemText, !item.id && styles.pickerItemClear]}>
                        {item.name}
                      </Text>
                      {cityId === item.id && item.id !== '' && (
                        <Ionicons name="checkmark" size={18} color={AMBER} />
                      )}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          </Modal>

          <Modal
            visible={langPickerVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setLangPickerVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <Pressable style={styles.modalBackdrop} onPress={() => setLangPickerVisible(false)} />
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalHeaderTitle}>{t('createTour.field.language')}</Text>
                  <TouchableOpacity onPress={() => setLangPickerVisible(false)} activeOpacity={0.7}>
                    <Ionicons name="close" size={22} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.pickerSearch}
                  value={langSearch}
                  onChangeText={setLangSearch}
                  placeholder={t('createTour.field.language')}
                  placeholderTextColor="#9CA3AF"
                  autoFocus
                  {...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {})}
                />
                <FlatList
                  data={filteredLanguages}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.pickerItem}
                      onPress={() => {
                        setLanguageCode(item.id);
                        setLanguageLabel(item.name);
                        setLangPickerVisible(false);
                        setLangSearch('');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.pickerItemText}>{item.name}</Text>
                      {languageCode === item.id && (
                        <Ionicons name="checkmark" size={18} color={AMBER} />
                      )}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          </Modal>
        </>
      )}

      {/* Desktop dropdown */}
      {isDesktop && ddConfig && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={closeDd}
        >
          <Pressable style={styles.ddBackdrop} onPress={closeDd} focusable={false} />
          <View
            style={[
              styles.ddDropdown,
              { top: ddConfig.y, left: ddConfig.x, minWidth: ddConfig.minWidth },
            ]}
          >
            {/* Search bar */}
            <View style={styles.ddSearchBar}>
              <Ionicons name="search-outline" size={15} color="#9CA3AF" />
              <TextInput
                style={styles.ddSearchInput}
                value={ddSearch}
                onChangeText={setDdSearch}
                placeholder={ddConfig.type === 'city' ? t('createTour.placeholder.city') : t('createTour.field.language')}
                placeholderTextColor="#9CA3AF"
                autoFocus
                {...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {})}
              />
            </View>
            <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
              {ddConfig.type === 'city' ? (
                <>
                  {[{ id: '', name: t('createTour.placeholder.city') }, ...cities.filter((c) =>
                    c.name.toLowerCase().includes(ddSearch.toLowerCase())
                  )].map((item) => (
                    <TouchableOpacity
                      key={item.id || '__clear__'}
                      style={[styles.ddOption, cityId === item.id && item.id !== '' && styles.ddOptionActive]}
                      onPress={() => {
                        setCityId(item.id);
                        setCityLabel(item.id ? item.name : '');
                        closeDd();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.ddOptionText, cityId === item.id && item.id !== '' && styles.ddOptionTextActive, !item.id && styles.pickerItemClear]}>
                        {item.name}
                      </Text>
                      {cityId === item.id && item.id !== '' && (
                        <Ionicons name="checkmark" size={16} color={AMBER} />
                      )}
                    </TouchableOpacity>
                  ))}
                </>
              ) : (
                <>
                  {languages.filter((l) =>
                    l.name.toLowerCase().includes(ddSearch.toLowerCase()) ||
                    l.id.toLowerCase().includes(ddSearch.toLowerCase())
                  ).map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.ddOption, languageCode === item.id && styles.ddOptionActive]}
                      onPress={() => {
                        setLanguageCode(item.id);
                        setLanguageLabel(item.name);
                        closeDd();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.ddOptionText, languageCode === item.id && styles.ddOptionTextActive]}>
                        {item.name}
                      </Text>
                      {languageCode === item.id && (
                        <Ionicons name="checkmark" size={16} color={AMBER} />
                      )}
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },

  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  required: { color: '#EF4444' },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  inputMultiline: { minHeight: 80, paddingTop: 10 },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  rowField: { flex: 1, minWidth: 100 },

  addStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: AMBER,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addStepBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  emptySteps: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 10 },
  emptyStepsText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },

  stepCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepOrderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOrderText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  stepActions: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  stepActionBtn: { padding: 6, borderRadius: 8, backgroundColor: '#F3F4F6' },
  stepDeleteBtn: { padding: 6, borderRadius: 8, backgroundColor: '#FEE2E2', marginLeft: 4 },

  subscriptionNote: { fontSize: 13, color: '#6B7280', marginBottom: 12, lineHeight: 18 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  errorBannerText: { flex: 1, fontSize: 14, color: '#EF4444', lineHeight: 20 },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AMBER,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },

  // Modal / picker styles
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
    paddingBottom: 16,
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
  modalHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  pickerSearch: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: '#F9FAFB',
    fontSize: 14,
    color: '#111827',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  pickerItemText: { fontSize: 15, color: '#111827' },
  pickerItemClear: { color: '#9CA3AF' },
});
