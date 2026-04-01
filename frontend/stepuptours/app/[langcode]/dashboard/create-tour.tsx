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
import {
  createTour,
  updateTour,
  createTourStep,
  updateTourStep,
  deleteTourStep,
  getActiveSubscription,
  getTourById,
  getTourStepsForEdit,
} from '../../../services/dashboard.service';
import { BusinessPicker } from '../../../components/dashboard/BusinessPicker';
import { ImagePickerField } from '../../../components/shared/ImagePickerField';
import PageBanner from '../../../components/layout/PageBanner';
import { uploadDrupalFile, getApiLanguage } from '../../../lib/drupal-client';
import type { Business, Subscription } from '../../../types';

const AMBER = '#F59E0B';
const CONTENT_MAX_WIDTH = 900;

interface StepEntry {
  /** Temporary React key. New steps only have this; persisted steps also have drupalId. */
  key: string;
  /** Drupal UUID — present only in edit mode for steps already saved to the backend. */
  drupalId?: string;
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
  const { langcode, tourId } = useLocalSearchParams<{ langcode: string; tourId?: string }>();
  const isEditMode = !!tourId;
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const isProfessional = user?.roles?.includes('professional');

  // Guard: avoid navigating before Root Layout mounts (Expo Router requirement)
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthLoading && (!user || !isProfessional)) {
      router.replace(`/${langcode}` as any);
    }
  }, [ready, user, isAuthLoading, isProfessional, langcode]);

  // ── Edit mode: loading state ──────────────────────────────────────────────
  const [isLoadingTour, setIsLoadingTour] = useState(isEditMode);
  // Track original step IDs present when the form loaded (to detect deletions)
  const originalStepIds = useRef<string[]>([]);
  // Entity langcode: the langcode of the loaded tour (used for PATCH URL routing)
  const [entityLangcode, setEntityLangcode] = useState<string>('');

  // ── Tour basic info ──────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');

  // ── Tour image ────────────────────────────────────────────────────────────
  // imageUri: local URI of a newly-picked file (not yet uploaded)
  // imageFilename: filename extracted from the picked file
  // uploadedImageId: UUID returned after uploading to Drupal
  // existingImageUrl: URL of the current image in edit mode (display only)
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageFilename, setImageFilename] = useState<string>('');
  const [uploadedImageId, setUploadedImageId] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

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
      // Language picker is locked in edit mode — the langcode is set at creation
      if (type === 'lang' && isEditMode) return;
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
    [isDesktop, isEditMode]
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
  const [languageCode, setLanguageCode] = useState(() => getApiLanguage() || 'es');
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

  // Sync language label when languages list loads (important for edit mode prefill)
  useEffect(() => {
    if (languages.length > 0 && languageCode) {
      const match = languages.find((l) => l.id === languageCode);
      if (match) setLanguageLabel(match.name);
    }
  }, [languages, languageCode]);

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

  // ── Edit mode: load existing tour data ────────────────────────────────────
  useEffect(() => {
    if (!isEditMode || !tourId) return;

    let cancelled = false;
    setIsLoadingTour(true);

    Promise.all([getTourById(tourId), getTourStepsForEdit(tourId)])
      .then(([tour, tourSteps]) => {
        if (cancelled) return;

        setTitle(tour.title);
        setDescription(tour.description);
        setDuration(tour.duration > 0 ? String(tour.duration) : '');

        if (tour.image) {
          setExistingImageUrl(tour.image);
        }

        if (tour.city) {
          setCityId(tour.city.id);
          setCityLabel(tour.city.name);
        }

        // Pre-fill language (locked in edit mode)
        if (tour.langcode) {
          setEntityLangcode(tour.langcode);
          setLanguageCode(tour.langcode);
          // Label will be resolved once languages are loaded — see effect below
        }

        // Pre-fill tour-level featured businesses (slots 1-3)
        const businesses: (Business | null)[] = [
          tour.featuredBusinesses[0] ?? null,
          tour.featuredBusinesses[1] ?? null,
          tour.featuredBusinesses[2] ?? null,
        ];
        setTourBusinesses(businesses);

        // Pre-fill steps
        const loadedSteps: StepEntry[] = tourSteps.map((s) => ({
          key: makeKey(),
          drupalId: s.id,
          title: s.title,
          description: s.description,
          lat: s.location ? String(s.location.lat) : '',
          lon: s.location ? String(s.location.lon) : '',
          duration: '', // field_duration not in TourStep type; leave blank
        }));
        setSteps(loadedSteps);
        originalStepIds.current = tourSteps.map((s) => s.id);

        // Pre-fill step-level featured businesses
        const stepBusinessMap: Record<string, Business | null> = {};
        tourSteps.forEach((s, idx) => {
          stepBusinessMap[loadedSteps[idx].key] = s.featuredBusiness ?? null;
        });
        setStepFeaturedBusiness(stepBusinessMap);
      })
      .catch(() => {
        // Non-fatal: show empty form if fetch fails
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTour(false);
      });

    return () => { cancelled = true; };
  }, [isEditMode, tourId]);

  // tourBusinessSlots: from subscription plan field_max_featured_detail
  // stepBusinessSlots: each step has one featured_business slot (field_featured_business)
  const tourBusinessSlots = subscription
    ? subscription.plan.maxFeaturedDetail
    : 1;

  // tourBusinesses: array of selected Business objects per tour-level slot
  const [tourBusinesses, setTourBusinesses] = useState<(Business | null)[]>([null, null, null]);

  // stepFeaturedBusiness: one Business per step (field_featured_business)
  const [stepFeaturedBusiness, setStepFeaturedBusiness] = useState<Record<string, Business | null>>({});

  const getStepBusiness = useCallback(
    (key: string): Business | null => stepFeaturedBusiness[key] ?? null,
    [stepFeaturedBusiness]
  );

  const updateStepBusiness = useCallback(
    (stepKey: string, business: Business | null) => {
      setStepFeaturedBusiness((prev) => ({ ...prev, [stepKey]: business }));
    },
    []
  );

  // Warn when the same business is used in multiple tour slots
  const tourBusinessIds = tourBusinesses.map((b) => b?.id).filter(Boolean) as string[];
  const hasDuplicateTourBusinesses =
    new Set(tourBusinessIds).size < tourBusinessIds.length;

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

    // Extract business UUIDs for the 3 tour-level slots (null = empty slot)
    const featuredBusinessIds: (string | null)[] = [
      tourBusinesses[0]?.id ?? null,
      tourBusinesses[1]?.id ?? null,
      tourBusinesses[2]?.id ?? null,
    ];

    setSaving(true);
    try {
      // Upload image if a new file was picked but not yet uploaded
      let imageId: string | null | undefined = uploadedImageId;
      if (imageUri && !uploadedImageId) {
        const fileId = await uploadDrupalFile('tour', 'field_image', imageUri, imageFilename || 'image.jpg');
        setUploadedImageId(fileId);
        imageId = fileId;
      }

      if (isEditMode && tourId) {
        // ── PATCH mode ────────────────────────────────────────────────────
        await updateTour(tourId, {
          title: title.trim(),
          description: description.trim(),
          duration: parseInt(duration, 10) || 0,
          cityId: cityId || undefined,
          featuredBusinessIds,
          // Pass imageId only when a new image was uploaded or image was explicitly cleared
          ...(imageId !== undefined ? { imageId } : {}),
        }, entityLangcode || undefined);

        // Determine which persisted steps were removed
        const currentDrupalIds = new Set(
          steps.filter((s) => s.drupalId).map((s) => s.drupalId as string)
        );
        const removedIds = originalStepIds.current.filter((id) => !currentDrupalIds.has(id));
        for (const id of removedIds) {
          await deleteTourStep(id);
        }

        // PATCH existing steps / POST new ones in order
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const lat = parseFloat(step.lat);
          const lon = parseFloat(step.lon);
          const hasLocation = !isNaN(lat) && !isNaN(lon);
          const stepBusinessId = stepFeaturedBusiness[step.key]?.id ?? null;

          if (step.drupalId) {
            await updateTourStep(step.drupalId, {
              title: step.title.trim(),
              description: step.description.trim(),
              order: i + 1,
              lat: hasLocation ? lat : undefined,
              lon: hasLocation ? lon : undefined,
              duration: step.duration ? parseInt(step.duration, 10) : undefined,
              featuredBusinessId: stepBusinessId,
            });
          } else {
            await createTourStep(tourId, {
              title: step.title.trim(),
              description: step.description.trim(),
              order: i + 1,
              lat: hasLocation ? lat : undefined,
              lon: hasLocation ? lon : undefined,
              duration: step.duration ? parseInt(step.duration, 10) : undefined,
              featuredBusinessId: stepBusinessId,
            });
          }
        }
      } else {
        // ── POST mode ─────────────────────────────────────────────────────
        const tour = await createTour({
          title: title.trim(),
          description: description.trim(),
          duration: parseInt(duration, 10) || 0,
          cityId: cityId || undefined,
          featuredBusinessIds,
          imageId: imageId ?? undefined,
          langcode: languageCode,
        });

        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const lat = parseFloat(step.lat);
          const lon = parseFloat(step.lon);
          const hasLocation = !isNaN(lat) && !isNaN(lon);
          const stepBusinessId = stepFeaturedBusiness[step.key]?.id ?? null;

          await createTourStep(tour.id, {
            title: step.title.trim(),
            description: step.description.trim(),
            order: i + 1,
            lat: hasLocation ? lat : undefined,
            lon: hasLocation ? lon : undefined,
            duration: step.duration ? parseInt(step.duration, 10) : undefined,
            featuredBusinessId: stepBusinessId,
          });
        }
      }

      router.replace(`/${langcode}/dashboard?tab=tours&toast=tour_saved` as any);
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
  }, [
    title, description, duration, cityId, steps, langcode, router, t,
    tourBusinesses, stepFeaturedBusiness, isEditMode, tourId,
    imageUri, imageFilename, uploadedImageId, languageCode, entityLangcode,
  ]);

  if (isAuthLoading || !user || !isProfessional || isLoadingTour) {
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
        keyboardShouldPersistTaps="handled"
      >
        <PageBanner
          icon={isEditMode ? 'create-outline' : 'add-circle-outline'}
          iconBgColor={AMBER}
          title={isEditMode ? t('createTour.editTitle', 'Edit Tour') : t('createTour.title')}
          subtitle={isEditMode ? t('createTour.editSubtitle', 'Update your tour details') : t('createTour.subtitle')}
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

            <ImagePickerField
              label={t('createTour.field.image', 'Cover Image')}
              currentImageUrl={imageUri ?? existingImageUrl}
              onImageSelected={(uri, filename) => {
                setImageUri(uri);
                setImageFilename(filename);
                setUploadedImageId(null); // reset so we re-upload on save
              }}
              onImageCleared={() => {
                setImageUri(null);
                setImageFilename('');
                setUploadedImageId(null);
                setExistingImageUrl(null);
              }}
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
                <Text style={styles.label}>
                  {isEditMode
                    ? t('createTour.field.languageLocked', 'Language (set at creation)')
                    : t('createTour.field.language')}
                </Text>
                <View ref={langBtnRef} collapsable={false}>
                  <TouchableOpacity
                    style={[styles.input, isEditMode && styles.inputLocked]}
                    onPress={() => openPicker('lang')}
                    activeOpacity={isEditMode ? 1 : 0.7}
                  >
                    <Text style={{ color: languageLabel ? (isEditMode ? '#6B7280' : '#111827') : '#9CA3AF', fontSize: 15 }}>
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

                  {user && (
                    <View>
                      <Text style={styles.label}>
                        {t('createTour.field.stepBusiness', { slot: 1 })}
                      </Text>
                      <BusinessPicker
                        selectedBusinessId={getStepBusiness(step.key)?.id ?? null}
                        selectedBusiness={getStepBusiness(step.key)}
                        onSelect={(b) => updateStepBusiness(step.key, b)}
                        placeholder={t('createTour.placeholder.businessId')}
                      />
                    </View>
                  )}
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
                {/* Subscription plan info */}
                <View style={styles.planBadge}>
                  <Ionicons name="star-outline" size={14} color={AMBER} />
                  <Text style={styles.planBadgeText}>
                    {subscription
                      ? `${subscription.plan.title} — ${tourBusinessSlots} featured slot${tourBusinessSlots !== 1 ? 's' : ''}`
                      : `Free plan — 1 featured slot`}
                  </Text>
                  {!subscription && (
                    <Text style={styles.upgradeHint}> · Upgrade for more</Text>
                  )}
                </View>

                {hasDuplicateTourBusinesses && (
                  <View style={styles.warnBanner}>
                    <Ionicons name="warning-outline" size={15} color="#D97706" />
                    <Text style={styles.warnText}>
                      The same business is selected in multiple slots.
                    </Text>
                  </View>
                )}

                {Array.from({ length: tourBusinessSlots }).map((_, idx) => (
                  <View key={idx}>
                    <Text style={styles.label}>
                      {t('createTour.field.tourBusiness', { slot: idx + 1 })}
                    </Text>
                    {user && (
                      <BusinessPicker
                        selectedBusinessId={tourBusinesses[idx]?.id ?? null}
                        selectedBusiness={tourBusinesses[idx]}
                        onSelect={(b) =>
                          setTourBusinesses((prev) => {
                            const next = [...prev];
                            next[idx] = b;
                            return next;
                          })
                        }
                        placeholder={t('createTour.placeholder.businessId')}
                      />
                    )}
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
  screen: { flex: 1, backgroundColor: '#F9FAFB', ...(Platform.OS === 'web' ? { height: '100vh' as any, overflow: 'hidden' as any } : {}) },
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
  inputLocked: { backgroundColor: '#F3F4F6', opacity: 0.75 },
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

  // Desktop dropdown
  ddBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  ddDropdown: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
    zIndex: 999,
  },
  ddSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  ddSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    height: 32,
  },
  ddOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  ddOptionActive: {
    backgroundColor: '#FFFBEB',
  },
  ddOptionText: {
    fontSize: 14,
    color: '#111827',
  },
  ddOptionTextActive: {
    color: AMBER,
    fontWeight: '600',
  },

  // Plan badge
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 14,
  },
  planBadgeText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
  },
  upgradeHint: {
    fontSize: 12,
    color: '#B45309',
  },

  // Duplicate business warning
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  warnText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
});
