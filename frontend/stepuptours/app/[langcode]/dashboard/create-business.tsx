// app/[langcode]/dashboard/create-business.tsx
// Create / Edit Business — full-page route (professional & administrator)

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
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
import { useLanguageStore } from '../../../stores/language.store';
import {
  getBusinessById,
  getBusinessCategories,
  createBusiness,
  updateBusiness,
  type BusinessInput,
} from '../../../services/business.service';
import { ImagePickerField } from '../../../components/shared/ImagePickerField';
import { uploadDrupalFile, getApiLanguage } from '../../../lib/drupal-client';
import PageBanner from '../../../components/layout/PageBanner';

const AMBER = '#F59E0B';
const CONTENT_MAX_WIDTH = 720;

interface FormState {
  name: string;
  description: string;
  website: string;
  phone: string;
  categoryId: string;
  lat: string;
  lon: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  website: '',
  phone: '',
  categoryId: '',
  lat: '',
  lon: '',
};

export default function CreateBusinessScreen() {
  const { langcode, businessId } = useLocalSearchParams<{
    langcode: string;
    businessId?: string;
  }>();
  const isEditMode = !!businessId;
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const isAdmin = user?.roles?.includes('administrator');

  // Auth guard — avoids navigating before Root Layout mounts (Expo Router requirement)
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthLoading && !user) {
      router.replace(`/${langcode}` as any);
    }
  }, [ready, user, isAuthLoading, langcode]);

  // ── Loading existing business in edit mode ────────────────────────────────
  const [isLoadingBusiness, setIsLoadingBusiness] = useState(isEditMode);

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // ── Logo image state ──────────────────────────────────────────────────────
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageFilename, setImageFilename] = useState<string>('');
  const [uploadedImageId, setUploadedImageId] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);

  // ── Category picker state ─────────────────────────────────────────────────
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [categoryLabel, setCategoryLabel] = useState('');
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  // ── Language picker state ─────────────────────────────────────────────────
  const [languageCode, setLanguageCode] = useState<string>(() => getApiLanguage() || 'es');
  const [languageLabel, setLanguageLabel] = useState('');
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  // Entity langcode: langcode of the loaded business (used for PATCH URL routing)
  const [entityLangcode, setEntityLangcode] = useState<string>('');

  const { languages, fetchLanguages } = useLanguageStore();

  useEffect(() => {
    if (languages.length === 0) {
      fetchLanguages();
    }
  }, []);

  // Sync language label when languages list loads (important for edit mode prefill)
  useEffect(() => {
    if (languages.length > 0 && languageCode) {
      const match = languages.find((l) => l.id === languageCode);
      if (match) setLanguageLabel(match.name);
    }
  }, [languages, languageCode]);

  const filteredLanguages = languages.filter((l) =>
    l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
    l.id.toLowerCase().includes(langSearch.toLowerCase())
  );

  // ── Desktop dropdown ──────────────────────────────────────────────────────
  const categoryBtnRef = useRef<View>(null);
  const langBtnRef = useRef<View>(null);
  const [ddConfig, setDdConfig] = useState<{
    type: 'category' | 'lang';
    x: number;
    y: number;
    minWidth: number;
  } | null>(null);
  const [ddSearch, setDdSearch] = useState('');

  const openPicker = useCallback(
    (type: 'category' | 'lang') => {
      // Language picker is locked in edit mode — the langcode is set at creation
      if (type === 'lang' && isEditMode) return;
      if (!isDesktop) {
        if (type === 'category') {
          setCategorySearch('');
          setCategoryPickerVisible(true);
        } else {
          setLangSearch('');
          setLangPickerVisible(true);
        }
        return;
      }
      const ref = type === 'category' ? categoryBtnRef : langBtnRef;
      ref.current?.measureInWindow((x, y, w, h) => {
        setDdSearch('');
        setDdConfig({ type, x, y: y + h + 4, minWidth: Math.max(w, 240) });
      });
    },
    [isDesktop, isEditMode]
  );

  const closeDd = useCallback(() => setDdConfig(null), []);

  // ── Save state ────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // ── Load categories ───────────────────────────────────────────────────────
  useEffect(() => {
    getBusinessCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  // ── Load existing business in edit mode ───────────────────────────────────
  useEffect(() => {
    if (!isEditMode || !businessId) return;

    let cancelled = false;
    setIsLoadingBusiness(true);

    getBusinessById(businessId)
      .then((business) => {
        if (cancelled) return;
        setForm({
          name: business.name,
          description: business.description ?? '',
          website: business.website ?? '',
          phone: business.phone ?? '',
          categoryId: business.category?.id ?? '',
          lat: business.location ? String(business.location.lat) : '',
          lon: business.location ? String(business.location.lon) : '',
        });
        setCategoryLabel(business.category?.name ?? '');
        if (business.logo) {
          setExistingLogoUrl(business.logo);
        }
        // Pre-fill language (locked in edit mode)
        if (business.langcode) {
          setEntityLangcode(business.langcode);
          setLanguageCode(business.langcode);
          // Label will be resolved once languages are loaded — see sync effect above
        }
      })
      .catch(() => {
        // Non-fatal — show empty form if fetch fails
      })
      .finally(() => {
        if (!cancelled) setIsLoadingBusiness(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isEditMode, businessId]);

  const update = useCallback((field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const filteredCategoriesDd = categories.filter((c) =>
    c.name.toLowerCase().includes(ddSearch.toLowerCase())
  );

  const filteredLanguagesDd = languages.filter((l) =>
    l.name.toLowerCase().includes(ddSearch.toLowerCase()) ||
    l.id.toLowerCase().includes(ddSearch.toLowerCase())
  );

  const selectCategory = useCallback(
    (id: string, name: string) => {
      update('categoryId', id);
      setCategoryLabel(id ? name : '');
      setCategoryPickerVisible(false);
      setCategorySearch('');
      closeDd();
    },
    [update, closeDd]
  );

  const selectLanguage = useCallback(
    (id: string, name: string) => {
      setLanguageCode(id);
      setLanguageLabel(name);
      setLangPickerVisible(false);
      setLangSearch('');
      closeDd();
    },
    [closeDd]
  );

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setValidationError(null);

    if (!form.name.trim()) {
      setValidationError(t('createBusiness.validation.nameRequired', 'Business name is required'));
      return;
    }

    setSaving(true);
    try {
      let logoId: string | null | undefined = uploadedImageId;
      if (imageUri && !uploadedImageId) {
        const fileId = await uploadDrupalFile(
          'business',
          'field_logo',
          imageUri,
          imageFilename || 'logo.jpg'
        );
        setUploadedImageId(fileId);
        logoId = fileId;
      }

      const lat = form.lat ? parseFloat(form.lat) : undefined;
      const lon = form.lon ? parseFloat(form.lon) : undefined;
      const hasLocation = lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon);

      const data: BusinessInput = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        website: form.website.trim() || undefined,
        phone: form.phone.trim() || undefined,
        categoryId: form.categoryId || undefined,
        lat: hasLocation ? lat : undefined,
        lon: hasLocation ? lon : undefined,
        ...(logoId !== undefined ? { logoId: logoId ?? undefined } : {}),
        langcode: languageCode,
      };

      if (isEditMode && businessId) {
        await updateBusiness(businessId, data, entityLangcode || undefined);
      } else {
        await createBusiness(data);
      }

      const returnPath = isAdmin
        ? `/${langcode}/admin?tab=businesses&toast=business_saved`
        : `/${langcode}/dashboard?tab=businesses&toast=business_saved`;
      router.replace(returnPath as any);
    } catch (err: any) {
      setValidationError(err.message ?? 'Error saving business');
    } finally {
      setSaving(false);
    }
  }, [form, isEditMode, businessId, router, imageUri, imageFilename, uploadedImageId, langcode, languageCode, entityLangcode, t]);
  // ── Loading / auth guard render ───────────────────────────────────────────
  if (isAuthLoading || !user || isLoadingBusiness) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  const contentStyle = {
    paddingHorizontal: 16,
    paddingTop: 24,
    ...(isDesktop
      ? { maxWidth: CONTENT_MAX_WIDTH, width: '100%' as const, alignSelf: 'center' as const }
      : {}),
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <PageBanner
          icon="business-outline"
          iconBgColor={AMBER}
          title={isEditMode ? 'Edit Business' : 'New Business'}
          subtitle={
            isEditMode
              ? 'Update your business details'
              : 'Add a new business to your portfolio'
          }
          showBack
        />

        <View style={contentStyle}>
          {/* Section: Business Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Business Details</Text>

            {/* Name */}
            <Text style={styles.label}>
              Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(v) => update('name', v)}
              placeholder="Business name"
              placeholderTextColor="#9CA3AF"
              maxLength={200}
            />

            {/* Description */}
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={form.description}
              onChangeText={(v) => update('description', v)}
              placeholder="Short description of the business"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Category */}
            <Text style={styles.label}>Category</Text>
            <View ref={categoryBtnRef} collapsable={false}>
              <TouchableOpacity
                style={styles.input}
                onPress={() => openPicker('category')}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    color: categoryLabel ? '#111827' : '#9CA3AF',
                    fontSize: 15,
                  }}
                >
                  {categoryLabel || 'Select category'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Language */}
            <Text style={styles.label}>
              {isEditMode
                ? t('createBusiness.field.languageLocked', 'Language (set at creation)')
                : t('createBusiness.field.language', 'Language')}
            </Text>
            <View ref={langBtnRef} collapsable={false}>
              <TouchableOpacity
                style={[styles.input, isEditMode && styles.inputLocked]}
                onPress={() => openPicker('lang')}
                activeOpacity={isEditMode ? 1 : 0.7}
              >
                <Text
                  style={{
                    color: languageLabel ? (isEditMode ? '#6B7280' : '#111827') : '#9CA3AF',
                    fontSize: 15,
                  }}
                >
                  {languageLabel || languageCode}
                </Text>
              </TouchableOpacity>
            </View>

            <ImagePickerField
              label="Logo"
              currentImageUrl={imageUri ?? existingLogoUrl}
              onImageSelected={(uri, filename) => {
                setImageUri(uri);
                setImageFilename(filename);
                setUploadedImageId(null); // reset so we re-upload on save
              }}
              onImageCleared={() => {
                setImageUri(null);
                setImageFilename('');
                setUploadedImageId(null);
                setExistingLogoUrl(null);
              }}
            />
          </View>

          {/* Section: Contact */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact & Location</Text>

            {/* Website */}
            <Text style={styles.label}>Website</Text>
            <TextInput
              style={styles.input}
              value={form.website}
              onChangeText={(v) => update('website', v)}
              placeholder="https://example.com"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="url"
            />

            {/* Phone */}
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(v) => update('phone', v)}
              placeholder="+34 600 000 000"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
            />

            {/* Location */}
            <Text style={styles.label}>Location (optional)</Text>
            <View style={styles.row}>
              <View style={styles.rowField}>
                <TextInput
                  style={styles.input}
                  value={form.lat}
                  onChangeText={(v) => update('lat', v)}
                  placeholder="Lat: 41.38"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.rowField}>
                <TextInput
                  style={styles.input}
                  value={form.lon}
                  onChangeText={(v) => update('lon', v)}
                  placeholder="Lon: 2.17"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>

          {/* Error banner */}
          {validationError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
              <Text style={styles.errorBannerText}>{validationError}</Text>
            </View>
          ) : null}

          {/* Save button */}
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
                <Text style={styles.saveBtnText}>
                  {isEditMode ? 'Save Changes' : 'Create Business'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>

      {/* Mobile fullscreen category picker */}
      {!isDesktop && (
        <Modal
          visible={categoryPickerVisible}
          transparent={false}
          animationType="slide"
          onRequestClose={() => setCategoryPickerVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Category</Text>
              <TouchableOpacity
                onPress={() => setCategoryPickerVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.pickerSearch}
              value={categorySearch}
              onChangeText={setCategorySearch}
              placeholder="Search category..."
              placeholderTextColor="#9CA3AF"
              autoFocus
              {...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {})}
            />
            <FlatList
              data={[{ id: '', name: 'No category' }, ...filteredCategories]}
              keyExtractor={(item) => item.id || '__clear__'}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => selectCategory(item.id, item.name)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      !item.id && styles.pickerItemClear,
                    ]}
                  >
                    {item.name}
                  </Text>
                  {form.categoryId === item.id && item.id !== '' && (
                    <Ionicons name="checkmark" size={18} color={AMBER} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </Modal>
      )}

      {/* Mobile fullscreen language picker */}
      {!isDesktop && (
        <Modal
          visible={langPickerVisible}
          transparent={false}
          animationType="slide"
          onRequestClose={() => setLangPickerVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>
                {t('createBusiness.field.language', 'Language')}
              </Text>
              <TouchableOpacity
                onPress={() => setLangPickerVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.pickerSearch}
              value={langSearch}
              onChangeText={setLangSearch}
              placeholder="Search language..."
              placeholderTextColor="#9CA3AF"
              autoFocus
              {...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {})}
            />
            <FlatList
              data={filteredLanguages}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => selectLanguage(item.id, item.name)}
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
        </Modal>
      )}

      {/* Desktop dropdown picker (category or language) */}
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
            <View style={styles.ddSearchBar}>
              <Ionicons name="search-outline" size={15} color="#9CA3AF" />
              <TextInput
                style={styles.ddSearchInput}
                value={ddSearch}
                onChangeText={setDdSearch}
                placeholder={ddConfig.type === 'category' ? 'Search category...' : 'Search language...'}
                placeholderTextColor="#9CA3AF"
                autoFocus
                {...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {})}
              />
            </View>
            <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
              {ddConfig.type === 'category'
                ? [{ id: '', name: 'No category' }, ...filteredCategoriesDd].map((item) => (
                    <TouchableOpacity
                      key={item.id || '__clear__'}
                      style={[
                        styles.ddOption,
                        form.categoryId === item.id && item.id !== '' && styles.ddOptionActive,
                      ]}
                      onPress={() => selectCategory(item.id, item.name)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.ddOptionText,
                          form.categoryId === item.id && item.id !== '' && styles.ddOptionTextActive,
                          !item.id && styles.pickerItemClear,
                        ]}
                      >
                        {item.name}
                      </Text>
                      {form.categoryId === item.id && item.id !== '' && (
                        <Ionicons name="checkmark" size={16} color={AMBER} />
                      )}
                    </TouchableOpacity>
                  ))
                : filteredLanguagesDd.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.ddOption,
                        languageCode === item.id && styles.ddOptionActive,
                      ]}
                      onPress={() => selectLanguage(item.id, item.name)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.ddOptionText,
                          languageCode === item.id && styles.ddOptionTextActive,
                        ]}
                      >
                        {item.name}
                      </Text>
                      {languageCode === item.id && (
                        <Ionicons name="checkmark" size={16} color={AMBER} />
                      )}
                    </TouchableOpacity>
                  ))}
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB', ...(Platform.OS === 'web' ? { height: '100vh' as any, overflow: 'hidden' as any } : {}) },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
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
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },
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
    justifyContent: 'center',
  },
  inputMultiline: {
    minHeight: 80,
    paddingTop: 10,
  },
  inputLocked: { backgroundColor: '#F3F4F6', opacity: 0.75 },

  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  rowField: { flex: 1, minWidth: 100 },

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
    paddingVertical: 13,
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
  },
  ddSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  ddSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    height: 28,
  },
  ddOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  ddOptionActive: { backgroundColor: '#FEF3C7' },
  ddOptionText: { fontSize: 14, color: '#111827' },
  ddOptionTextActive: { fontWeight: '600', color: '#92400E' },
});
