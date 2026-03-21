// components/admin/TranslationsTab.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import CountryFlag from 'react-native-country-flag';
import { langCodeToCountryCode } from '../../services/language.service';
import {
  getAdminLanguages,
  getTranslations,
  saveTranslations,
  type AdminLanguage,
  type TranslationRow,
} from '../../services/admin.service';

const AMBER = '#F59E0B';

const GROUP_LABELS: Record<string, string> = {
  nav: 'Navigation',
  tour: 'Tour',
  home: 'Home',
  step: 'Steps',
  filter: 'Filters',
  ranking: 'Ranking',
  profile: 'Profile',
  dashboard: 'Dashboard',
  auth: 'Authentication',
  footer: 'Footer',
  popup: 'Popups',
  admin: 'Administration',
  card: 'Cards',
  business: 'Business',
  donation: 'Donations',
  subscription: 'Subscriptions',
  legal: 'Legal',
  cookie: 'Cookies',
  contact: 'Contact',
  rating: 'Rating',
  completed: 'Completed',
  favourites: 'Favourites',
  createTour: 'Create Tour',
};

function getGroupKey(translationKey: string): string {
  // Handle keys like "createTour.title" (two-word prefix)
  if (translationKey.startsWith('createTour.')) return 'createTour';
  const dot = translationKey.indexOf('.');
  return dot > 0 ? translationKey.substring(0, dot) : translationKey;
}

export function TranslationsTab() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [languages, setLanguages] = useState<AdminLanguage[]>([]);
  const [selectedLang, setSelectedLang] = useState<string>('');
  const [translations, setTranslations] = useState<TranslationRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modifications, setModifications] = useState<Map<string, string>>(new Map());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingTranslations, setLoadingTranslations] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load languages on mount
  useEffect(() => {
    getAdminLanguages()
      .then((langs) => {
        setLanguages(langs);
        const nonEn = langs.find((l) => l.id !== 'en');
        setSelectedLang(nonEn?.id ?? langs[0]?.id ?? 'es');
      })
      .catch(() => {
        setLanguages([{ id: 'es', label: 'Spanish' }, { id: 'en', label: 'English' }]);
        setSelectedLang('es');
      })
      .finally(() => setLoading(false));
  }, []);

  // Load translations when language changes
  useEffect(() => {
    if (!selectedLang) return;
    setLoadingTranslations(true);
    setModifications(new Map());
    setFeedback(null);
    getTranslations(selectedLang)
      .then(setTranslations)
      .catch(() => setTranslations([]))
      .finally(() => setLoadingTranslations(false));
  }, [selectedLang]);

  const handleModify = useCallback((key: string, value: string) => {
    setModifications((prev) => {
      const next = new Map(prev);
      next.set(key, value);
      return next;
    });
    setFeedback(null);
  }, []);

  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (modifications.size === 0) return;
    setSaving(true);
    setFeedback(null);
    try {
      const entries = Array.from(modifications.entries()).map(([key, value]) => ({ key, value }));
      await saveTranslations(selectedLang, entries);
      // Update local translations with saved values
      setTranslations((prev) =>
        prev.map((row) => {
          const mod = modifications.get(row.key);
          return mod !== undefined ? { ...row, target: mod } : row;
        }),
      );
      setModifications(new Map());
      setFeedback({ type: 'success', message: t('admin.translations.saved') });
    } catch {
      setFeedback({ type: 'error', message: 'Error saving translations' });
    } finally {
      setSaving(false);
    }
  };

  // Filter translations
  const query = searchQuery.toLowerCase();
  const filtered = query
    ? translations.filter(
        (row) =>
          row.key.toLowerCase().includes(query) ||
          row.source.toLowerCase().includes(query) ||
          row.target.toLowerCase().includes(query),
      )
    : translations;

  // Group by prefix
  const groups = new Map<string, TranslationRow[]>();
  for (const row of filtered) {
    const group = getGroupKey(row.key);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(row);
  }

  const isEnglish = selectedLang === 'en';
  const modCount = modifications.size;

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  return (
    <View>
      {/* Language Selector Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.langPills}
      >
        {languages.map((lang) => {
          const isActive = lang.id === selectedLang;
          return (
            <TouchableOpacity
              key={lang.id}
              style={[styles.langPill, isActive && styles.langPillActive]}
              onPress={() => setSelectedLang(lang.id)}
              activeOpacity={0.8}
            >
              <CountryFlag isoCode={langCodeToCountryCode(lang.id)} size={14} />
              <Text style={[styles.langPillText, isActive && styles.langPillTextActive]}>
                {lang.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* English read-only notice */}
      {isEnglish && (
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={18} color="#1D4ED8" />
          <Text style={styles.infoBannerText}>{t('admin.translations.sourceReadOnly')}</Text>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('admin.translations.searchPlaceholder')}
          placeholderTextColor="#D1D5DB"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#D1D5DB" />
          </TouchableOpacity>
        )}
      </View>

      {/* Loading translations */}
      {loadingTranslations && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={AMBER} />
        </View>
      )}

      {/* Translation Groups */}
      {!loadingTranslations &&
        Array.from(groups.entries()).map(([group, rows]) => {
          const isCollapsed = collapsedGroups.has(group);
          const label = GROUP_LABELS[group] ?? group.charAt(0).toUpperCase() + group.slice(1);

          return (
            <View key={group} style={styles.groupCard}>
              {/* Group Header */}
              <TouchableOpacity
                style={styles.groupHeader}
                onPress={() => toggleGroup(group)}
                activeOpacity={0.7}
              >
                <View style={styles.groupHeaderLeft}>
                  <Ionicons
                    name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                    size={16}
                    color="#6B7280"
                  />
                  <Text style={styles.groupTitle}>{label}</Text>
                </View>
                <View style={styles.groupBadge}>
                  <Text style={styles.groupBadgeText}>{rows.length}</Text>
                </View>
              </TouchableOpacity>

              {/* Rows */}
              {!isCollapsed &&
                rows.map((row) => {
                  const modValue = modifications.get(row.key);
                  const currentValue = modValue !== undefined ? modValue : row.target;
                  const isModified = modValue !== undefined;

                  return (
                    <View
                      key={row.key}
                      style={[styles.translationRow, isModified && styles.translationRowModified]}
                    >
                      {/* Key */}
                      <Text style={styles.keyText}>{row.key}</Text>

                      {isMobile ? (
                        // Mobile: key above, input below
                        <TextInput
                          style={[styles.targetInput, isEnglish && styles.targetInputDisabled]}
                          value={isEnglish ? row.source : currentValue}
                          onChangeText={(val) => handleModify(row.key, val)}
                          editable={!isEnglish}
                          multiline
                          placeholder={row.source}
                          placeholderTextColor="#D1D5DB"
                        />
                      ) : (
                        // Desktop: source + target side by side
                        <View style={styles.desktopColumns}>
                          <Text style={styles.sourceText} numberOfLines={2}>
                            {row.source}
                          </Text>
                          <TextInput
                            style={[styles.targetInput, styles.targetInputDesktop, isEnglish && styles.targetInputDisabled]}
                            value={isEnglish ? row.source : currentValue}
                            onChangeText={(val) => handleModify(row.key, val)}
                            editable={!isEnglish}
                            multiline
                            placeholder={row.source}
                            placeholderTextColor="#D1D5DB"
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
            </View>
          );
        })}

      {/* No results */}
      {!loadingTranslations && filtered.length === 0 && (
        <View style={styles.emptyWrap}>
          <Ionicons name="search-outline" size={36} color="#D1D5DB" />
          <Text style={styles.emptyText}>{t('admin.translations.noResults')}</Text>
        </View>
      )}

      {/* Unsaved changes counter + Save button */}
      {!isEnglish && (
        <View style={styles.saveSection}>
          {modCount > 0 && (
            <Text style={styles.unsavedText}>
              {t('admin.translations.unsavedChanges', { count: modCount })}
            </Text>
          )}

          {feedback && (
            <View style={[styles.feedbackBanner, feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError]}>
              <Ionicons
                name={feedback.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={feedback.type === 'success' ? '#065F46' : '#991B1B'}
              />
              <Text style={[styles.feedbackBannerText, feedback.type === 'success' ? { color: '#065F46' } : { color: '#991B1B' }]}>
                {feedback.message}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, (saving || modCount === 0) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving || modCount === 0}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>{t('admin.translations.save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },

  // ── Language pills ──────────────────────────────────────────────────────
  langPills: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginBottom: 16,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  langPillActive: {
    backgroundColor: AMBER,
  },
  langPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  langPillTextActive: {
    color: '#FFFFFF',
  },

  // ── Info banner ─────────────────────────────────────────────────────────
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoBannerText: {
    fontSize: 13,
    color: '#1D4ED8',
    fontWeight: '500',
    flex: 1,
  },

  // ── Search ──────────────────────────────────────────────────────────────
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    color: '#374151',
  },

  // ── Groups ──────────────────────────────────────────────────────────────
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
      default: { elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
    }),
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  groupBadge: {
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  groupBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },

  // ── Translation rows ───────────────────────────────────────────────────
  translationRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  translationRowModified: {
    borderLeftWidth: 3,
    borderLeftColor: AMBER,
    backgroundColor: '#FFFBEB',
  },
  keyText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    color: '#9CA3AF',
    marginBottom: 6,
  },
  desktopColumns: {
    flexDirection: 'row',
    gap: 16,
  },
  sourceText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
    paddingTop: 8,
  },
  targetInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#FAFAFA',
  },
  targetInputDesktop: {
    flex: 1,
  },
  targetInputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },

  // ── Empty ───────────────────────────────────────────────────────────────
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },

  // ── Save section ────────────────────────────────────────────────────────
  saveSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  unsavedText: {
    fontSize: 13,
    fontWeight: '600',
    color: AMBER,
    marginBottom: 10,
    textAlign: 'center',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  feedbackSuccess: {
    backgroundColor: '#ECFDF5',
  },
  feedbackError: {
    backgroundColor: '#FEF2F2',
  },
  feedbackBannerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: AMBER,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
