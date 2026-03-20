// app/[langcode]/(tabs)/index.tsx
import { useEffect, useCallback, useState } from 'react';
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
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useToursStore } from '../../../stores/tours.store';
import { useAuthStore } from '../../../stores/auth.store';
import { TourCard } from '../../../components/tour/TourCard';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import type { TourFilters } from '../../../types';
import Footer from '../../../components/layout/Footer';

// ── Travel Pattern SVG Banner ─────────────────────────────────────────────────
function TravelPatternBackground({ width, height }: { width: number; height: number }) {
  if (!width || width === 0) return null;

  const icons = [
    { x: 40, y: 30, el: 'globe' }, { x: 160, y: 80, el: 'plane' },
    { x: 280, y: 20, el: 'compass' }, { x: 380, y: 70, el: 'globe' },
    { x: 500, y: 30, el: 'plane' }, { x: 620, y: 80, el: 'compass' },
    { x: 740, y: 20, el: 'globe' }, { x: 860, y: 60, el: 'plane' },
    { x: 980, y: 30, el: 'compass' }, { x: 1100, y: 75, el: 'globe' },
    { x: 1220, y: 20, el: 'plane' }, { x: 1340, y: 65, el: 'compass' },
    { x: 80, y: 140, el: 'compass' }, { x: 200, y: 170, el: 'globe' },
    { x: 320, y: 130, el: 'plane' }, { x: 440, y: 160, el: 'compass' },
    { x: 560, y: 140, el: 'globe' }, { x: 680, y: 170, el: 'plane' },
    { x: 800, y: 130, el: 'compass' }, { x: 920, y: 155, el: 'globe' },
    { x: 1040, y: 135, el: 'plane' }, { x: 1160, y: 160, el: 'compass' },
    { x: 1280, y: 130, el: 'globe' }, { x: 20, y: 230, el: 'plane' },
    { x: 140, y: 260, el: 'compass' }, { x: 260, y: 220, el: 'globe' },
    { x: 380, y: 250, el: 'plane' }, { x: 500, y: 225, el: 'compass' },
    { x: 620, y: 255, el: 'globe' }, { x: 740, y: 220, el: 'plane' },
    { x: 860, y: 250, el: 'compass' }, { x: 980, y: 225, el: 'globe' },
    { x: 1100, y: 240, el: 'plane' }, { x: 1220, y: 215, el: 'compass' },
    { x: 1340, y: 245, el: 'globe' },
  ];

  const renderIcon = (type: string, x: number, y: number, key: string) => {
    const color = 'rgba(245,158,11,0.12)';
    if (type === 'globe') return (
      <G key={key} transform={`translate(${x},${y})`}>
        <Circle cx="10" cy="10" r="9" stroke={color} strokeWidth="1.5" fill="none" />
        <Path d="M10 1 Q13 5 13 10 Q13 15 10 19" stroke={color} strokeWidth="1.2" fill="none" />
        <Path d="M10 1 Q7 5 7 10 Q7 15 10 19" stroke={color} strokeWidth="1.2" fill="none" />
        <Path d="M1.5 7 Q5 8.5 10 8.5 Q15 8.5 18.5 7" stroke={color} strokeWidth="1.2" fill="none" />
        <Path d="M1.5 13 Q5 11.5 10 11.5 Q15 11.5 18.5 13" stroke={color} strokeWidth="1.2" fill="none" />
      </G>
    );
    if (type === 'plane') return (
      <G key={key} transform={`translate(${x},${y}) rotate(-30, 10, 10)`}>
        <Path d="M10 2 L14 8 L20 8 L18 10 L14 10 L16 16 L13 15 L10 10 L7 15 L4 16 L6 10 L2 10 L0 8 L6 8 Z" fill={color} />
      </G>
    );
    if (type === 'compass') return (
      <G key={key} transform={`translate(${x},${y})`}>
        <Circle cx="10" cy="10" r="9" stroke={color} strokeWidth="1.5" fill="none" />
        <Path d="M10 3 L12 10 L10 17 L8 10 Z" fill={color} />
        <Path d="M3 10 L10 8 L17 10 L10 12 Z" fill="rgba(245,158,11,0.06)" />
        <Circle cx="10" cy="10" r="1.5" fill={color} />
      </G>
    );
    return null;
  };

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFillObject}>
      {icons.map((icon, i) => renderIcon(icon.el, icon.x % width, icon.y, `icon-${i}`))}
    </Svg>
  );
}

// ── Country Dropdown ──────────────────────────────────────────────────────────
interface CountryDropdownProps {
  countries: { id: string; name: string }[];
  selected: string | undefined;
  onSelect: (country: string | null) => void;
  label: string;
  allLabel: string;
}

function CountryDropdown({ countries, selected, onSelect, label, allLabel }: CountryDropdownProps) {
  const [open, setOpen] = useState(false);
  const activeLabel = selected ?? allLabel;

  return (
    <View>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        style={styles.dropdownTrigger}
      >
        <Text style={styles.dropdownTriggerText}>🌍 {activeLabel}</Text>
        <Text style={styles.dropdownChevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.dropdownBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.dropdownMenu}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownHeaderText}>{label}</Text>
            </View>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.dropdownItem, !selected && styles.dropdownItemActive]}
                onPress={() => { onSelect(null); setOpen(false); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.dropdownItemText, !selected && styles.dropdownItemTextActive]}>
                  🌍 {allLabel}
                </Text>
                {!selected && <Text style={styles.dropdownCheck}>✓</Text>}
              </TouchableOpacity>
              {countries.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.dropdownItem, selected === c.name && styles.dropdownItemActive]}
                  onPress={() => { onSelect(c.name); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dropdownItemText, selected === c.name && styles.dropdownItemTextActive]}>
                    {c.name}
                  </Text>
                  {selected === c.name && <Text style={styles.dropdownCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ── Filter Select (inline dropdown) ──────────────────────────────────────────
interface FilterSelectOption {
  id: string;
  name: string;
}

interface FilterSelectProps {
  label: string;
  value: string | undefined;
  options: FilterSelectOption[];
  onSelect: (opt: FilterSelectOption | null) => void;
  placeholder: string;
}

function FilterSelect({ label, value, options, onSelect, placeholder }: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = value || placeholder;

  return (
    <View>
      <Text style={styles.filterLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.selectBtn}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.8}
      >
        <Text style={value ? styles.selectText : styles.selectPlaceholder} numberOfLines={1}>
          {selectedLabel}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
      </TouchableOpacity>
      {open && (
        <View style={styles.selectDropdown}>
          <TouchableOpacity
            style={[styles.selectOption, !value && styles.selectOptionActive]}
            onPress={() => { onSelect(null); setOpen(false); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.selectOptionText, !value && styles.selectOptionTextActive]}>
              {placeholder}
            </Text>
          </TouchableOpacity>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.selectOption, value === opt.name && styles.selectOptionActive]}
              onPress={() => { onSelect(opt); setOpen(false); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.selectOptionText, value === opt.name && styles.selectOptionTextActive]}>
                {opt.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Filters Panel ─────────────────────────────────────────────────────────────
interface FiltersPanelProps {
  filters: TourFilters;
  countries: { id: string; name: string }[];
  cities: { id: string; name: string }[];
  onCountrySelect: (name: string | null) => void;
  onCitySelect: (name: string | null) => void;
  onSortSelect: (sort: TourFilters['sort']) => void;
  onApply: () => void;
  onClear: () => void;
}

function FiltersPanel({
  filters,
  countries,
  cities,
  onCountrySelect,
  onCitySelect,
  onSortSelect,
  onApply,
  onClear,
}: FiltersPanelProps) {
  const { t } = useTranslation();

  const sortOptions: { key: TourFilters['sort']; label: string }[] = [
    { key: 'rating', label: t('filter.sortRating') },
    { key: 'alphabetical', label: t('filter.sortAlpha') },
    { key: 'popular', label: t('filter.sortPopular') },
  ];

  return (
    <View style={styles.filtersPanel}>
      {/* Country */}
      <FilterSelect
        label={t('filter.country')}
        value={filters.country}
        options={countries}
        onSelect={(opt) => onCountrySelect(opt ? opt.name : null)}
        placeholder={t('filter.selectCountry')}
      />

      {/* City */}
      <FilterSelect
        label={t('filter.city')}
        value={filters.city}
        options={cities}
        onSelect={(opt) => onCitySelect(opt ? opt.name : null)}
        placeholder={t('filter.selectCity')}
      />

      {/* Sort */}
      <View>
        <Text style={styles.filterLabel}>{t('filter.sort')}</Text>
        <View style={styles.chipRow}>
          {sortOptions.map((opt) => {
            const isActive = filters.sort === opt.key || (!filters.sort && opt.key === 'rating');
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => onSortSelect(opt.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.filterActions}>
        <TouchableOpacity style={styles.clearBtn} onPress={onClear} activeOpacity={0.8}>
          <Text style={styles.clearBtnText}>{t('filter.clear')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.applyBtn} onPress={onApply} activeOpacity={0.8}>
          <Text style={styles.applyBtnText}>{t('filter.apply')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Homepage ──────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const {
    tours, isLoading, hasMore, filters,
    countries, cities, fetchTours, fetchCountries, fetchCities,
    setFilters, clearFilters,
    userActivities, fetchUserActivities, toggleFavorite,
  } = useToursStore();

  const { user, openAuthModal } = useAuthStore();

  useEffect(() => {
    fetchTours();
    fetchCountries();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserActivities(user.id);
    }
  }, [user?.id]);

  // Responsive columns: 3 cols (≥768) → 2 cols (≥640) → 1 col
  const cols = width >= 768 ? 3 : width >= 640 ? 2 : 1;
  const GRID_MAX_WIDTH = 1200;
  const PADDING = width >= 768 ? 32 : 16;
  const GAP = 20;
  const gridWidth = Math.min(width, GRID_MAX_WIDTH);
  const cardWidth = cols === 1
    ? width - PADDING * 2
    : (gridWidth - PADDING * 2 - GAP * (cols - 1)) / cols;

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    fetchTours({ page: (filters.page ?? 1) + 1 }, true);
  }, [hasMore, isLoading, filters.page]);

  const onRefresh = useCallback(() => fetchTours({ page: 1 }), []);

  const onSearch = () => {
    setFilters({ search });
    fetchTours({ search, page: 1 });
  };

  // Determine if any non-default filter is active (for icon highlight)
  const hasActiveFilters = !!(filters.country || filters.city || filters.sort);

  const handleCountrySelect = (country: string | null) => {
    if (country === null) {
      setFilters({ country: undefined, city: undefined });
    } else {
      setFilters({ country, city: undefined });
      fetchCities(country);
    }
  };

  const handleCitySelect = (city: string | null) => {
    setFilters({ city: city ?? undefined });
  };

  const handleSortSelect = (sort: TourFilters['sort']) => {
    setFilters({ sort });
  };

  const handleApply = () => {
    fetchTours({ ...filters, page: 1 });
    setShowFilters(false);
  };

  const handleClear = () => {
    clearFilters();
    setSearch('');
    fetchTours({});
    setShowFilters(false);
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={tours}
        keyExtractor={(item) => item.id}
        numColumns={cols}
        key={`grid-${cols}`}
        columnWrapperStyle={cols > 1 ? {
          maxWidth: GRID_MAX_WIDTH,
          alignSelf: 'center',
          width: '100%',
          paddingHorizontal: PADDING,
          justifyContent: 'space-between',
        } : undefined}
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: 0,
        }}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && tours.length > 0}
            onRefresh={onRefresh}
            tintColor="#F59E0B"
          />
        }
        ListHeaderComponent={
          <>
            {/* ── BANNER ── */}
            <View style={styles.banner}>
              <TravelPatternBackground width={width} height={300} />
              <View style={styles.bannerContent}>
                <Text style={styles.bannerTitle}>StepUp Tours</Text>
                <Text style={styles.bannerSubtitle}>{t('home.subtitle')}</Text>
                <View style={[styles.searchBar, { width: Math.min(width - 48, 600) }]}>
                  <Text style={styles.searchIcon}>🔍</Text>
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
                    <TouchableOpacity onPress={() => { setSearch(''); clearFilters(); fetchTours(); }}>
                      <Text style={{ color: '#9CA3AF', fontSize: 16, paddingHorizontal: 8 }}>✕</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.filterIconBtn, (showFilters || hasActiveFilters) && styles.filterIconBtnActive]}
                    onPress={() => setShowFilters((v) => !v)}
                  >
                    <Ionicons
                      name="options-outline"
                      size={20}
                      color={showFilters || hasActiveFilters ? '#FFFFFF' : '#374151'}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* ── EXPANDABLE FILTERS PANEL ── */}
            {showFilters && (
              <FiltersPanel
                filters={filters}
                countries={countries}
                cities={cities}
                onCountrySelect={handleCountrySelect}
                onCitySelect={handleCitySelect}
                onSortSelect={handleSortSelect}
                onApply={handleApply}
                onClear={handleClear}
              />
            )}

            <View style={{ height: 24 }} />
          </>
        }
        renderItem={({ item }) => (
          <View style={cols === 1 ? {
            maxWidth: GRID_MAX_WIDTH,
            alignSelf: 'center',
            width: '100%',
            paddingHorizontal: PADDING,
          } : undefined}>
            <TourCard
              tour={item}
              cardWidth={cardWidth}
              langcode={langcode}
              isAuthenticated={!!user}
              isFavorite={userActivities[item.id]?.isFavorite ?? false}
              isCompleted={userActivities[item.id]?.isCompleted ?? false}
              onToggleFavorite={() => {
                if (!user) {
                  openAuthModal('login');
                  return;
                }
                toggleFavorite(user.id, item.id);
              }}
            />
          </View>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 48 }}>🗺️</Text>
              <Text style={styles.emptyTitle}>{t('home.noTours')}</Text>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => { clearFilters(); fetchTours(); }}>
                <Text style={styles.btnPrimaryText}>{t('home.allCountries')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#F59E0B" />
            </View>
          )
        }
        ListFooterComponent={
          <>
            {hasMore && isLoading && (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#F59E0B" />
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
  root: { flex: 1, backgroundColor: '#F9FAFB' },

  btnPrimary: { backgroundColor: '#F59E0B', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  banner: {
    height: 280, backgroundColor: '#FFFBEB',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  bannerContent: { alignItems: 'center', paddingHorizontal: 24, zIndex: 1 },
  bannerTitle: {
    fontSize: 36, fontWeight: '800', color: '#D97706',
    letterSpacing: -1, textAlign: 'center',
    ...(Platform.OS === 'web' ? { textShadow: '0 2px 12px rgba(245,158,11,0.15)' } as any : {}),
  },
  bannerSubtitle: {
    fontSize: 15, color: '#92400E', opacity: 0.7,
    marginTop: 4, marginBottom: 24, textAlign: 'center',
    fontWeight: '400', letterSpacing: 0.2,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    gap: 10,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 20px rgba(0,0,0,0.1)' } as any
      : { elevation: 4 }),
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', paddingVertical: 0 },
  filterIconBtn: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  filterIconBtnActive: {
    backgroundColor: '#F59E0B',
  },

  // Filters panel (expandable)
  filtersPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },

  // Inline select dropdown
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  selectText: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '500' },
  selectPlaceholder: { flex: 1, fontSize: 14, color: '#9CA3AF' },
  selectDropdown: {
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    maxHeight: 200,
  },
  selectOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectOptionActive: { backgroundColor: '#FFFBEB' },
  selectOptionText: { fontSize: 14, color: '#374151' },
  selectOptionTextActive: { color: '#D97706', fontWeight: '600' },

  // Sort chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  chipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },

  // Action buttons
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  applyBtn: {
    flex: 1,
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  clearBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  clearBtnText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
  },

  // Filters row (kept for CountryDropdown if reused elsewhere)
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },

  // Dropdown
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  dropdownTriggerText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  dropdownChevron: { fontSize: 10, color: '#9CA3AF' },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  dropdownMenu: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 110 : 160,
    left: 16,
    minWidth: 220,
    maxHeight: 320,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  dropdownHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  dropdownItemActive: { backgroundColor: '#FFFBEB' },
  dropdownItemText: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '400' },
  dropdownItemTextActive: { color: '#D97706', fontWeight: '600' },
  dropdownCheck: { color: '#F59E0B', fontSize: 14 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 16, color: '#6B7280', fontWeight: '500' },
  loadingState: { paddingVertical: 60, alignItems: 'center' },
});