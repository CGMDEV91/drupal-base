// app/[langcode]/(tabs)/index.tsx
import { useEffect, useCallback, useState, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Platform,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useToursStore } from '../../../stores/tours.store';
import { useAuthStore } from '../../../stores/auth.store';
import { useLanguageStore } from '../../../stores/language.store';
import { TourCard } from '../../../components/tour/TourCard';
import { Ionicons } from '@expo/vector-icons';
import type { TourFilters } from '../../../types';
import Footer from '../../../components/layout/Footer';
const AMBER = '#F59E0B';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1920&q=80';

// ── Desktop: chip row centrado ────────────────────────────────────────────────
interface DesktopChipRowProps {
  filters: TourFilters;
  countries: { id: string; name: string }[];
  cities: { id: string; name: string }[];
  onCountrySelect: (c: string | null) => void;
  onCitySelect: (c: string | null) => void;
  onSortSelect: (s: TourFilters['sort']) => void;
  onClear: () => void;
}

interface DesktopDropdownConfig {
  type: 'sort' | 'country' | 'city';
  x: number;
  y: number;
  minWidth: number;
}

function DesktopChipRow({
  filters,
  countries,
  cities,
  onCountrySelect,
  onCitySelect,
  onSortSelect,
  onClear,
}: DesktopChipRowProps) {
  const { t } = useTranslation();
  const [openChip, setOpenChip] = useState<null | 'sort' | 'country' | 'city'>(null);
  const [ddConfig, setDdConfig] = useState<DesktopDropdownConfig | null>(null);
  const [ddSearch, setDdSearch] = useState('');

  const sortRef = useRef<any>(null);
  const countryRef = useRef<any>(null);
  const cityRef = useRef<any>(null);

  const sortOptions: { key: NonNullable<TourFilters['sort']>; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'rating', label: t('filter.sortRating'), icon: 'star-outline' },
    { key: 'alphabetical', label: t('filter.sortAlpha'), icon: 'text-outline' },
    { key: 'popular', label: t('filter.sortPopular'), icon: 'flame-outline' },
  ];

  const activeSortLabel =
    sortOptions.find((o) => o.key === (filters.sort ?? 'rating'))?.label ?? t('filter.sort');
  const hasActive = !!(filters.country || filters.city || filters.sort);

  const openFilter = (ref: React.RefObject<any>, type: 'sort' | 'country' | 'city') => {
    ref.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
      setDdSearch('');
      setDdConfig({ type, x, y: y + h + 6, minWidth: Math.max(w, 240) });
      setOpenChip(type);
    });
  };

  const close = () => { setOpenChip(null); setDdConfig(null); setDdSearch(''); };

  const renderOption = (
    key: string,
    label: string,
    isActive: boolean,
    icon: keyof typeof Ionicons.glyphMap | null,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={key}
      style={[styles.ddOption, isActive && styles.ddOptionActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon && <Ionicons name={icon} size={16} color={isActive ? AMBER : '#9CA3AF'} />}
      <Text style={[styles.ddOptionText, isActive && styles.ddOptionTextActive]}>{label}</Text>
      {isActive && <Ionicons name="checkmark" size={16} color={AMBER} />}
    </TouchableOpacity>
  );

  const renderOptions = (type: typeof openChip) => {
    const q = ddSearch.trim().toLowerCase();
    if (type === 'sort') {
      return sortOptions.map((o) =>
        renderOption(o.key, o.label, (filters.sort ?? 'rating') === o.key, o.icon, () => {
          onSortSelect(o.key); close();
        }),
      );
    }
    if (type === 'country') {
      const filtered = q ? countries.filter((c) => c.name.toLowerCase().includes(q)) : countries;
      return [
        renderOption('all', t('filter.selectCountry'), !filters.country, 'earth-outline', () => {
          onCountrySelect(null); close();
        }),
        ...filtered.map((c) =>
          renderOption(c.id, c.name, filters.country === c.name, null, () => {
            onCountrySelect(c.name); close();
          }),
        ),
      ];
    }
    if (type === 'city') {
      const filtered = q ? cities.filter((c) => c.name.toLowerCase().includes(q)) : cities;
      return [
        renderOption('all', t('filter.selectCity'), !filters.city, 'location-outline', () => {
          onCitySelect(null); close();
        }),
        ...filtered.map((c) =>
          renderOption(c.id, c.name, filters.city === c.name, null, () => {
            onCitySelect(c.name); close();
          }),
        ),
      ];
    }
    return null;
  };

  return (
    <View style={styles.desktopChipWrapper}>
      <View style={styles.desktopChipInner}>
        <View ref={sortRef}>
          <TouchableOpacity
            style={[styles.chip, filters.sort && styles.chipActive]}
            onPress={() => openFilter(sortRef, 'sort')}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-vertical-outline" size={13} color={filters.sort ? '#fff' : '#374151'} />
            <Text style={[styles.chipText, filters.sort && styles.chipTextActive]}>{activeSortLabel}</Text>
            <Ionicons name="chevron-down" size={11} color={filters.sort ? 'rgba(255,255,255,0.7)' : '#9CA3AF'} />
          </TouchableOpacity>
        </View>
        <View ref={countryRef}>
          <TouchableOpacity
            style={[styles.chip, filters.country && styles.chipActive]}
            onPress={() => openFilter(countryRef, 'country')}
            activeOpacity={0.7}
          >
            <Ionicons name="earth-outline" size={13} color={filters.country ? '#fff' : '#374151'} />
            <Text style={[styles.chipText, filters.country && styles.chipTextActive]}>
              {filters.country ?? t('filter.country')}
            </Text>
            <Ionicons name="chevron-down" size={11} color={filters.country ? 'rgba(255,255,255,0.7)' : '#9CA3AF'} />
          </TouchableOpacity>
        </View>
        <View ref={cityRef}>
          <TouchableOpacity
            style={[styles.chip, filters.city && styles.chipActive]}
            onPress={() => openFilter(cityRef, 'city')}
            activeOpacity={0.7}
          >
            <Ionicons name="location-outline" size={13} color={filters.city ? '#fff' : '#374151'} />
            <Text style={[styles.chipText, filters.city && styles.chipTextActive]}>
              {filters.city ?? t('filter.city')}
            </Text>
            <Ionicons name="chevron-down" size={11} color={filters.city ? 'rgba(255,255,255,0.7)' : '#9CA3AF'} />
          </TouchableOpacity>
        </View>
        {hasActive && (
          <TouchableOpacity style={styles.clearChip} onPress={onClear} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={14} color="#EF4444" />
            <Text style={styles.clearChipText}>{t('filter.clear')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {openChip && ddConfig && (
        <Modal visible transparent animationType="fade" onRequestClose={close}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close}>
            <Pressable
              style={[
                styles.desktopDropdown,
                { left: ddConfig.x, top: ddConfig.y, minWidth: ddConfig.minWidth },
              ]}
            >
              {(openChip === 'country' || openChip === 'city') && (
                <View style={styles.ddSearchBar}>
                  <Ionicons name="search-outline" size={14} color="#9CA3AF" />
                  <TextInput
                    style={styles.ddSearchInput}
                    placeholder={t('filter.search')}
                    placeholderTextColor="#C4C9D4"
                    value={ddSearch}
                    onChangeText={setDdSearch}
                  />
                  {ddSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setDdSearch('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Ionicons name="close-circle" size={14} color="#C4C9D4" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <ScrollView bounces={false} style={{ maxHeight: 280 }}>
                {renderOptions(openChip)}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

// ── Mobile: botón filtro + modal fullscreen ───────────────────────────────────
interface MobileFilterBarProps {
  filters: TourFilters;
  countries: { id: string; name: string }[];
  cities: { id: string; name: string }[];
  onApplyAll: (sort: TourFilters['sort'], country: string | null, city: string | null) => void;
  onClear: () => void;
  onFetchCities: (country?: string) => void;
  cardPadding: number;
}

function MobileFilterBar({
  filters,
  countries,
  cities,
  onApplyAll,
  onClear,
  onFetchCities,
  cardPadding,
}: MobileFilterBarProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pendingSort, setPendingSort] = useState<TourFilters['sort']>(filters.sort);
  const [pendingCountry, setPendingCountry] = useState<string | undefined>(filters.country);
  const [pendingCity, setPendingCity] = useState<string | undefined>(filters.city);
  const [countrySearch, setCountrySearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [expandedSection, setExpandedSection] = useState<'sort' | 'country' | 'city' | null>(null);

  const sortOptions: { key: NonNullable<TourFilters['sort']>; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'rating', label: t('filter.sortRating'), icon: 'star-outline' },
    { key: 'alphabetical', label: t('filter.sortAlpha'), icon: 'text-outline' },
    { key: 'popular', label: t('filter.sortPopular'), icon: 'flame-outline' },
  ];

  const activeCount = [filters.sort, filters.country, filters.city].filter(Boolean).length;
  const hasActive = activeCount > 0;
  const currentSortLabel = sortOptions.find((o) => o.key === (pendingSort ?? 'rating'))?.label ?? '';

  const openModal = () => {
    setPendingSort(filters.sort);
    setPendingCountry(filters.country);
    setPendingCity(filters.city);
    setCountrySearch('');
    setCitySearch('');
    setExpandedSection(null);
    onFetchCities(filters.country);
    setOpen(true);
  };

  const close = () => setOpen(false);

  const handleApply = () => {
    onApplyAll(pendingSort, pendingCountry ?? null, pendingCity ?? null);
    close();
  };

  const handleClearPending = () => {
    setPendingSort(undefined);
    setPendingCountry(undefined);
    setPendingCity(undefined);
    onClear();
    close();
  };

  const toggleSection = (section: 'sort' | 'country' | 'city') => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  return (
    <>
      <View style={[styles.mobileFilterBar, { paddingHorizontal: cardPadding }]}>
        <TouchableOpacity style={styles.mobileFilterTrigger} onPress={openModal} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={15} color="#374151" />
          <Text style={styles.mobileFilterTriggerText}>{t('filter.filters')}</Text>
          {hasActive && (
            <View style={styles.mobileFilterBadge}>
              <Text style={styles.mobileFilterBadgeText}>{activeCount}</Text>
            </View>
          )}
          <Ionicons name="chevron-down" size={13} color="#9CA3AF" />
        </TouchableOpacity>
        {hasActive && (
          <TouchableOpacity onPress={() => { onClear(); }} activeOpacity={0.7} style={styles.mobileClearBtn}>
            <Ionicons name="close-circle" size={14} color="#EF4444" />
            <Text style={styles.mobileClearText}>{t('filter.clear')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.mobileModalBackdrop} onPress={close} focusable={false} />
        <View style={styles.mobileModalSheet}>
          <View style={styles.mobileModalHeader}>
            <TouchableOpacity onPress={handleClearPending} activeOpacity={0.7} style={styles.mobileModalClearBtn}>
              <Text style={styles.mobileModalClearText}>{t('filter.clear')}</Text>
            </TouchableOpacity>
            <Text style={styles.mobileModalTitle}>{t('filter.filters')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity onPress={handleApply} activeOpacity={0.8} style={styles.mobileModalApplyBtn}>
                <Text style={styles.mobileModalApplyText}>{t('filter.apply')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView bounces={false} style={{ flex: 1 }}>

            {/* Sort section */}
            <View style={styles.filterSection}>
              <TouchableOpacity style={styles.filterSectionRow} onPress={() => toggleSection('sort')} activeOpacity={0.7}>
                <Text style={styles.mobileSectionLabel}>{t('filter.sort')}</Text>
                <View style={styles.filterSectionRight}>
                  <Text style={styles.filterSectionValue} numberOfLines={1}>{currentSortLabel}</Text>
                  <Ionicons name={expandedSection === 'sort' ? 'chevron-up' : 'chevron-down'} size={16} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
              {expandedSection === 'sort' && sortOptions.map((o) => {
                const isActive = (pendingSort ?? 'rating') === o.key;
                return (
                  <TouchableOpacity
                    key={o.key}
                    style={[styles.mobileOption, isActive && styles.mobileOptionActive]}
                    onPress={() => { setPendingSort(o.key); setExpandedSection(null); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={o.icon} size={18} color={isActive ? AMBER : '#6B7280'} />
                    <Text style={[styles.mobileOptionText, isActive && styles.mobileOptionTextActive]}>{o.label}</Text>
                    {isActive && <Ionicons name="checkmark" size={18} color={AMBER} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Country section */}
            <View style={styles.filterSection}>
              <TouchableOpacity style={styles.filterSectionRow} onPress={() => toggleSection('country')} activeOpacity={0.7}>
                <Text style={styles.mobileSectionLabel}>{t('filter.country')}</Text>
                <View style={styles.filterSectionRight}>
                  <Text style={styles.filterSectionValue} numberOfLines={1}>
                    {pendingCountry || t('filter.selectCountry')}
                  </Text>
                  <Ionicons name={expandedSection === 'country' ? 'chevron-up' : 'chevron-down'} size={16} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
              {expandedSection === 'country' && (
                <>
                  <View style={styles.mobileSectionSearch}>
                    <Ionicons name="search-outline" size={14} color="#9CA3AF" />
                    <TextInput
                      style={styles.mobileSectionSearchInput}
                      placeholder={t('filter.search')}
                      placeholderTextColor="#C4C9D4"
                      value={countrySearch}
                      onChangeText={setCountrySearch}
                    />
                    {countrySearch.length > 0 && (
                      <TouchableOpacity onPress={() => setCountrySearch('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Ionicons name="close-circle" size={14} color="#C4C9D4" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <ScrollView style={{ maxHeight: 220 }} bounces={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {[{ id: 'all', name: t('filter.selectCountry') }, ...countries.filter((c) =>
                      !countrySearch.trim() || c.name.toLowerCase().includes(countrySearch.trim().toLowerCase())
                    )].map((c) => {
                      const isActive = c.id === 'all' ? !pendingCountry : pendingCountry === c.name;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.mobileOption, isActive && styles.mobileOptionActive]}
                          onPress={() => {
                            const newCountry = c.id === 'all' ? undefined : c.name;
                            setPendingCountry(newCountry);
                            if (!newCountry) setPendingCity(undefined);
                            onFetchCities(newCountry);
                            setExpandedSection(null);
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="earth-outline" size={18} color={isActive ? AMBER : '#6B7280'} />
                          <Text style={[styles.mobileOptionText, isActive && styles.mobileOptionTextActive]}>{c.name}</Text>
                          {isActive && <Ionicons name="checkmark" size={18} color={AMBER} />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}
            </View>

            {/* City section */}
            <View style={[styles.filterSection, { marginBottom: 32 }]}>
              <TouchableOpacity style={styles.filterSectionRow} onPress={() => toggleSection('city')} activeOpacity={0.7}>
                <Text style={styles.mobileSectionLabel}>{t('filter.city')}</Text>
                <View style={styles.filterSectionRight}>
                  <Text style={styles.filterSectionValue} numberOfLines={1}>
                    {pendingCity || t('filter.selectCity')}
                  </Text>
                  <Ionicons name={expandedSection === 'city' ? 'chevron-up' : 'chevron-down'} size={16} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
              {expandedSection === 'city' && (
                <>
                  <View style={styles.mobileSectionSearch}>
                    <Ionicons name="search-outline" size={14} color="#9CA3AF" />
                    <TextInput
                      style={styles.mobileSectionSearchInput}
                      placeholder={t('filter.search')}
                      placeholderTextColor="#C4C9D4"
                      value={citySearch}
                      onChangeText={setCitySearch}
                    />
                    {citySearch.length > 0 && (
                      <TouchableOpacity onPress={() => setCitySearch('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Ionicons name="close-circle" size={14} color="#C4C9D4" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <ScrollView style={{ maxHeight: 220 }} bounces={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {[{ id: 'all', name: t('filter.selectCity') }, ...cities.filter((c) =>
                      !citySearch.trim() || c.name.toLowerCase().includes(citySearch.trim().toLowerCase())
                    )].map((c) => {
                      const isActive = c.id === 'all' ? !pendingCity : pendingCity === c.name;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.mobileOption, isActive && styles.mobileOptionActive]}
                          onPress={() => { setPendingCity(c.id === 'all' ? undefined : c.name); setExpandedSection(null); }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="location-outline" size={18} color={isActive ? AMBER : '#6B7280'} />
                          <Text style={[styles.mobileOptionText, isActive && styles.mobileOptionTextActive]}>{c.name}</Text>
                          {isActive && <Ionicons name="checkmark" size={18} color={AMBER} />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}
            </View>

          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

// ── Homepage ──────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');

  const {
    tours, isLoading, hasMore, filters,
    countries, cities, fetchTours, fetchCountries, fetchCities,
    setFilters, clearFilters,
    userActivities, fetchUserActivities, toggleFavorite,
  } = useToursStore();

  const { user, openAuthModal } = useAuthStore();
  const currentLanguageId = useLanguageStore((s) => s.currentLanguage?.id);

  // ── Fetch coordination ───────────────────────────────────────────────────────
  // isFocusedRef: tracks whether this screen is currently in focus (no re-render).
  // focusGeneration: increments on each real focus event, acting as a trigger
  //   for useEffect so it can react to tab-refocus without useFocusEffect deps.
  const isFocusedRef = useRef(false);
  const [focusGeneration, setFocusGeneration] = useState(0);
  const loadingMoreRef = useRef(false);

  // Empty deps → callback never changes → useFocusEffect only fires on actual
  // focus/blur events, NEVER on language or state changes.
  // This is the key to preventing double-fetches.
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      setFocusGeneration((g) => g + 1);
      return () => { isFocusedRef.current = false; };
    }, []),
  );

  // Single consolidated fetch effect.
  // Triggers on: (1) tab focus (focusGeneration↑), (2) language synced/changed
  // (currentLanguageId), (3) URL langcode change.
  // Guards: screen must be focused AND language must match the URL langcode.
  useEffect(() => {
    if (!isFocusedRef.current) return;
    if (!currentLanguageId || currentLanguageId !== langcode) return;
    clearFilters();
    setSearch('');
    loadingMoreRef.current = false;
    fetchTours({});
    fetchCountries();
    fetchCities();
  }, [currentLanguageId, langcode, focusGeneration]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) fetchUserActivities(user.id);
  }, [user?.id]);

  const cols = width >= 768 ? 3 : width >= 640 ? 2 : 1;
  const GRID_MAX_WIDTH = 1200;
  const PADDING = width >= 768 ? 32 : 16;
  const GAP = 20;
  const gridWidth = Math.min(width, GRID_MAX_WIDTH);
  const cardWidth =
    cols === 1
      ? width - PADDING * 2
      : (gridWidth - PADDING * 2 - GAP * (cols - 1)) / cols;

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || loadingMoreRef.current || tours.length === 0) return;
    loadingMoreRef.current = true;
    fetchTours({ page: (filters.page ?? 1) + 1 }, true).finally(() => {
      loadingMoreRef.current = false;
    });
  }, [hasMore, isLoading, filters.page, tours.length]);

  const onRefresh = useCallback(() => {
    loadingMoreRef.current = false;
    return fetchTours({ page: 1 });
  }, []);

  const onSearch = () => {
    loadingMoreRef.current = false;
    setFilters({ search });
    fetchTours({ search, page: 1 });
  };

  const handleCountrySelect = (country: string | null) => {
    const next = country ? { country, city: undefined } : { country: undefined, city: undefined };
    setFilters(next);
    fetchCities(country ?? undefined);
    loadingMoreRef.current = false;
    fetchTours({ ...filters, ...next, page: 1 });
  };

  const handleCitySelect = (city: string | null) => {
    const next = { city: city ?? undefined };
    setFilters(next);
    loadingMoreRef.current = false;
    fetchTours({ ...filters, ...next, page: 1 });
  };

  const handleSortSelect = (sort: TourFilters['sort']) => {
    setFilters({ sort });
    loadingMoreRef.current = false;
    fetchTours({ ...filters, sort, page: 1 });
  };

  const handleClear = () => {
    clearFilters();
    setSearch('');
    loadingMoreRef.current = false;
    fetchTours({});
  };

  const handleApplyAll = (sort: TourFilters['sort'], country: string | null, city: string | null) => {
    const next: Partial<TourFilters> = {
      sort: sort ?? undefined,
      country: country ?? undefined,
      city: city ?? undefined,
      page: 1,
    };
    setFilters(next);
    if (country) fetchCities(country);
    loadingMoreRef.current = false;
    fetchTours({ ...filters, ...next });
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={tours}
        keyExtractor={(item) => item.id}
        numColumns={cols}
        key={`grid-${cols}`}
        bounces={false}
        overScrollMode="never"
        columnWrapperStyle={
          cols > 1
            ? {
                maxWidth: GRID_MAX_WIDTH,
                alignSelf: 'center',
                width: '100%',
                paddingHorizontal: PADDING,
                justifyContent: 'space-between',
                paddingBottom: 10,
              }
            : undefined
        }
        contentContainerStyle={{ flexGrow: 1, paddingTop: 0, paddingBottom: 0 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && tours.length > 0}
            onRefresh={onRefresh}
            tintColor={AMBER}
          />
        }
        ListHeaderComponent={
          <>
            {/* ── HERO BANNER ── */}
            <View style={styles.banner}>
              <Image
                source={{ uri: HERO_IMAGE }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={700}
              />
              <View style={styles.overlayBottom} />
              <View style={styles.bannerContent}>
                <View style={styles.bannerEyebrow}>
                  <View style={styles.eyebrowLine} />
                  <Ionicons name="airplane-outline" size={14} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.eyebrowText}>STEPUP TOURS</Text>
                  <View style={styles.eyebrowLine} />
                </View>
                <Text style={styles.bannerTitle}>{t('home.heroTitle')}</Text>
                <Text style={styles.bannerSubtitle}>{t('home.subtitle')}</Text>
                <View style={[styles.searchBar, { width: Math.min(width - 48, 640) }]}>
                  <Ionicons name="search-outline" size={18} color="#9CA3AF" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder={t('home.searchPlaceholder')}
                    placeholderTextColor="#9CA3AF"
                    value={search}
                    onChangeText={setSearch}
                    onSubmitEditing={onSearch}
                    returnKeyType="search"
                  />
                  {search.length > 0 && (
                    <TouchableOpacity
                      onPress={() => { setSearch(''); clearFilters(); loadingMoreRef.current = false; fetchTours(); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={18} color="#C4C9D4" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            {/* ── FILTERS ── */}
            {width >= 768 ? (
              <DesktopChipRow
                filters={filters}
                countries={countries}
                cities={cities}
                onCountrySelect={handleCountrySelect}
                onCitySelect={handleCitySelect}
                onSortSelect={handleSortSelect}
                onClear={handleClear}
              />
            ) : (
              <MobileFilterBar
                filters={filters}
                countries={countries}
                cities={cities}
                onApplyAll={handleApplyAll}
                onClear={handleClear}
                onFetchCities={fetchCities}
                cardPadding={PADDING}
              />
            )}

            {/* ── TOUR COUNT PILL ── */}
            {/* Shown whenever there are tours (loading or not) so the pill never
                causes a layout shift that pushes cards down after first paint. */}
            {tours.length > 0 && (
              <View style={[styles.countPillRow, { paddingHorizontal: PADDING }]}>
                <View style={[styles.countPill, isLoading && { opacity: 0.4 }]}>
                  <Text style={styles.countPillText}>{tours.length} {t('home.tours')}</Text>
                </View>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => (
          <View
            style={
              cols === 1
                ? { maxWidth: GRID_MAX_WIDTH, alignSelf: 'center', width: '100%',paddingVertical: 10, paddingHorizontal: PADDING }
                : undefined
            }
          >
            <TourCard
              tour={item}
              cardWidth={cardWidth}
              langcode={langcode}
              isAuthenticated={!!user}
              isFavorite={userActivities[item.id]?.isFavorite ?? false}
              isCompleted={userActivities[item.id]?.isCompleted ?? false}
              onToggleFavorite={() => {
                if (!user) { openAuthModal('login'); return; }
                toggleFavorite(user.id, item.id);
              }}
            />
          </View>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Ionicons name="map-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>{t('home.noTours')}</Text>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => { clearFilters(); loadingMoreRef.current = false; fetchTours(); }}>
                <Text style={styles.btnPrimaryText}>{t('home.allCountries')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={AMBER} />
            </View>
          )
        }
        ListFooterComponent={
          <>
            {hasMore && isLoading && (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={AMBER} />
              </View>
            )}
            <Footer />
          </>
        }
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', ...(Platform.OS === 'web' ? { height: '100vh' as any, overflow: 'hidden' as any } : {}) },

  btnPrimary: { backgroundColor: AMBER, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20 },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  banner: {
    height: 340,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#1A2744',
  },
  overlayBottom: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(8,12,26,0.60)',
  },
  bannerContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
    zIndex: 1,
  },
  bannerEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  eyebrowLine: {
    width: 24,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 2.5,
  },
  bannerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 37,
    marginBottom: 7,
    ...(Platform.OS === 'web'
      ? ({ textShadow: '0 2px 20px rgba(0,0,0,0.5)' } as any)
      : {
          textShadowColor: 'rgba(0,0,0,0.5)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 12,
        }),
  },
  bannerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    marginBottom: 22,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === 'web' ? 16 : 14,
    gap: 12,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 40px rgba(0,0,0,0.28)' } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.28,
          shadowRadius: 16,
          elevation: 10,
        }),
  },
  searchInput: {
    flex: 1,
    fontSize: Platform.OS === 'web' ? 16 : 15,
    color: '#111827',
    paddingVertical: 0,
    ...Platform.select({
      web: {
        outlineWidth: 0,
        outlineStyle: 'none',
        boxShadow: 'none',
        borderWidth: 0,
      } as any,
    }),
  },
  desktopChipWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 10,
  },
  desktopChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 32,
  },
  mobileFilterBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileFilterTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  mobileFilterTriggerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  mobileFilterBadge: {
    backgroundColor: AMBER,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  mobileFilterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mobileClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  mobileClearText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  mobileModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  mobileModalSheet: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 52 : 28,
  },
  mobileModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  mobileModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  mobileModalClearBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    minWidth: 60,
  },
  mobileModalClearText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  mobileModalApplyBtn: {
    backgroundColor: AMBER,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    minWidth: 60,
    alignItems: 'center',
  },
  mobileModalApplyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mobileSection: {
    paddingTop: 8,
  },
  filterSection: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  filterSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  filterSectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'flex-end',
  },
  filterSectionValue: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    maxWidth: 160,
    textAlign: 'right',
  },
  mobileSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  mobileOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F9FAFB',
    backgroundColor: '#FFFFFF',
  },
  mobileOptionActive: {
    backgroundColor: '#FFFBEB',
  },
  mobileOptionText: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
    fontWeight: '400',
  },
  mobileOptionTextActive: {
    color: '#D97706',
    fontWeight: '600',
  },
  countPillRow: {
    paddingTop: 20,
    paddingBottom: 10,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  countPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  countPillText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
  },
  ddSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  ddSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    paddingVertical: 0,
    ...Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any }),
  },
  mobileSectionSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
  },
  mobileSectionSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 0,
    ...Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any }),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    backgroundColor: AMBER,
    borderColor: AMBER,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextActive: { color: '#FFFFFF' },
  clearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  clearChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
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
  ddOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  ddOptionActive: {
    backgroundColor: '#FFFBEB',
  },
  ddOptionText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  ddOptionTextActive: {
    color: '#D97706',
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 14,
  },
  emptyTitle: { fontSize: 16, color: '#6B7280', fontWeight: '500' },
  loadingState: { flex: 1, paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },
});
