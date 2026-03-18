// app/[langcode]/(tabs)/index.tsx
import { useEffect, useCallback, useState, useRef } from 'react';
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
import { TourCard } from '../../../components/tour/TourCard';
import Svg, { Path, Circle, G } from 'react-native-svg';

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

// ── Homepage ──────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');

  const {
    tours, isLoading, hasMore, filters,
    countries, fetchTours, fetchCountries,
    setFilters, clearFilters,
  } = useToursStore();

  useEffect(() => {
    fetchTours();
    fetchCountries();
  }, []);

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  // Móvil: 1 columna, tablet: 2, desktop: 3-4
  const cols = isDesktop ? 4 : isTablet ? 2 : 1;
  const PADDING = isDesktop ? 32 : 16;
  const GAP = 12;
  const cardWidth = cols === 1
    ? width - PADDING * 2
    : (width - PADDING * 2 - GAP * (cols - 1)) / cols;

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    fetchTours({ page: (filters.page ?? 1) + 1 }, true);
  }, [hasMore, isLoading, filters.page]);

  const onRefresh = useCallback(() => fetchTours({ page: 1 }), []);

  const onSearch = () => {
    setFilters({ search });
    fetchTours({ search, page: 1 });
  };

  const handleCountrySelect = (country: string | null) => {
    if (country === null) {
      clearFilters();
      fetchTours();
    } else {
      setFilters({ country });
      fetchTours({ country, page: 1 });
    }
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={tours}
        keyExtractor={(item) => item.id}
        numColumns={cols}
        key={`grid-${cols}`}
        columnWrapperStyle={cols > 1 ? { gap: GAP, paddingHorizontal: PADDING } : undefined}
        contentContainerStyle={[
          { paddingBottom: 40 },
          cols === 1 && { paddingHorizontal: PADDING },
        ]}
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
                  <TouchableOpacity style={styles.searchBtn} onPress={onSearch}>
                    <Text style={styles.searchBtnText}>{t('filter.apply')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* ── FILTERS ROW ── */}
            {countries.length > 0 && (
              <View style={styles.filtersRow}>
                <CountryDropdown
                  countries={countries}
                  selected={filters.country}
                  onSelect={handleCountrySelect}
                  label={t('filter.country')}
                  allLabel={t('home.allCountries')}
                />
              </View>
            )}

            {/* ── SECTION TITLE ── */}
            <View style={[styles.sectionHeader, { paddingHorizontal: PADDING }]}>
              <Text style={styles.sectionTitle}>
                {filters.country ? filters.country : t('home.featuredTours')}
              </Text>
              <Text style={styles.sectionCount}>{tours.length} {t('home.tours')}</Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <TourCard tour={item} cardWidth={cardWidth} langcode={langcode} />
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
          hasMore && isLoading ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#F59E0B" />
            </View>
          ) : null
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
    borderRadius: 16, paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    gap: 8,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 20px rgba(245,158,11,0.15)', backdropFilter: 'blur(8px)' } as any
      : { elevation: 4 }),
    borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.2)',
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', paddingVertical: 0 },
  searchBtn: { backgroundColor: '#F59E0B', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  searchBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Filters row
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

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingTop: 20, paddingBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  sectionCount: { fontSize: 13, color: '#9CA3AF' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 16, color: '#6B7280', fontWeight: '500' },
  loadingState: { paddingVertical: 60, alignItems: 'center' },
});