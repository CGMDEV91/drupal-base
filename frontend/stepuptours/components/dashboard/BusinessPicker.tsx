// components/dashboard/BusinessPicker.tsx
// Reusable search-and-select component for picking a Business by name.
//
// Desktop:  dropdown positioned below the trigger (same pattern as homepage filters)
// Mobile:   fullscreen slide-up modal (same pattern as homepage mobile filter)

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchBusinessesByName } from '../../services/business.service';
import type { Business } from '../../types';

const AMBER = '#F59E0B';

export interface BusinessPickerProps {
  selectedBusinessId: string | null;
  onSelect: (business: Business | null) => void;
  /** Filter results to this user's businesses. Omit to search all businesses. */
  userId?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Selected business object (for display name) */
  selectedBusiness?: Business | null;
}

interface DropdownPos {
  x: number;
  y: number;
  minWidth: number;
}

export function BusinessPicker({
  selectedBusinessId,
  onSelect,
  userId,
  disabled = false,
  placeholder = 'Search business…',
  selectedBusiness,
}: BusinessPickerProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const triggerRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Business[]>([]);
  const [searching, setSearching] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load initial list ─────────────────────────────────────────────────────
  const loadResults = useCallback((q = '') => {
    setSearching(true);
    searchBusinessesByName(q, userId)
      .then(setResults)
      .catch(() => {})
      .finally(() => setSearching(false));
  }, [userId]);

  // ── Open ─────────────────────────────────────────────────────────────────
  const openPicker = useCallback(() => {
    if (disabled) return;
    setQuery('');
    setResults([]);

    if (isDesktop) {
      triggerRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
        setDropdownPos({ x, y: y + h + 4, minWidth: Math.max(w, 280) });
        setModalVisible(true);
        loadResults('');
      });
    } else {
      setModalVisible(true);
      loadResults('');
    }
  }, [disabled, isDesktop, loadResults]);

  // ── Close ─────────────────────────────────────────────────────────────────
  const close = useCallback(() => {
    setModalVisible(false);
    setDropdownPos(null);
    setQuery('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // ── Search with debounce ──────────────────────────────────────────────────
  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadResults(text), 350);
  }, [loadResults]);

  // ── Select ────────────────────────────────────────────────────────────────
  const handleSelect = useCallback((business: Business) => {
    onSelect(business);
    close();
  }, [onSelect, close]);

  const handleClear = useCallback(() => {
    onSelect(null);
  }, [onSelect]);

  // ── Display name ──────────────────────────────────────────────────────────
  const displayName = selectedBusiness?.name
    ?? (selectedBusinessId ? `ID: ${selectedBusinessId.slice(0, 8)}…` : null);

  // ── Shared: search bar ────────────────────────────────────────────────────
  const searchBar = (
    <View style={styles.searchBar}>
      <Ionicons name="search-outline" size={15} color="#9CA3AF" />
      <TextInput
        style={styles.searchInput}
        value={query}
        onChangeText={handleQueryChange}
        placeholder="Search by name…"
        placeholderTextColor="#9CA3AF"
        autoFocus
        {...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {})}
      />
      {searching ? (
        <ActivityIndicator size="small" color={AMBER} />
      ) : query.length > 0 ? (
        <TouchableOpacity onPress={() => { setQuery(''); loadResults(''); }} hitSlop={8}>
          <Ionicons name="close-circle" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  // ── Shared: result item ───────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Business }) => (
    <TouchableOpacity
      style={[styles.resultItem, item.id === selectedBusinessId && styles.resultItemSelected]}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.resultIcon}>
        <Ionicons name="business-outline" size={18} color={AMBER} />
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
        {item.category ? (
          <Text style={styles.resultCategory}>{item.category.name}</Text>
        ) : null}
      </View>
      {item.id === selectedBusinessId && (
        <Ionicons name="checkmark-circle" size={18} color={AMBER} />
      )}
    </TouchableOpacity>
  );

  const emptyComponent = !searching ? (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>No businesses found</Text>
    </View>
  ) : null;

  // ── Desktop dropdown ──────────────────────────────────────────────────────
  const desktopDropdown = dropdownPos ? (
    <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close}>
        <Pressable
          style={[
            styles.desktopDropdown,
            { left: dropdownPos.x, top: dropdownPos.y, minWidth: dropdownPos.minWidth },
          ]}
        >
          {searchBar}
          <ScrollView bounces={false} style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
            {results.length === 0 ? emptyComponent : results.map((item) => (
              <View key={item.id}>{renderItem({ item })}</View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  ) : null;

  // ── Mobile fullscreen (starts from top, matches homepage filters / Navbar lang picker) ──
  const mobileModal = (
    <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.mobileFullscreen}>
        <View style={styles.mobileHeader}>
          <Text style={styles.mobileTitle}>Select Business</Text>
          <TouchableOpacity onPress={close} activeOpacity={0.7} hitSlop={8}>
            <Ionicons name="close" size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>
        {searchBar}
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={renderItem}
          ListEmptyComponent={emptyComponent}
          style={{ flex: 1 }}
        />
      </View>
    </Modal>
  );

  // ── Trigger area (ref'd for measureInWindow) ──────────────────────────────
  return (
    <View ref={triggerRef}>
      {selectedBusinessId && displayName ? (
        // Selected chip
        <View style={styles.chip}>
          <Ionicons name="business-outline" size={14} color={AMBER} />
          <Text style={styles.chipText} numberOfLines={1}>{displayName}</Text>
          {selectedBusiness?.category ? (
            <Text style={styles.chipCategory}>{selectedBusiness.category.name}</Text>
          ) : null}
          {!disabled && (
            <TouchableOpacity onPress={handleClear} activeOpacity={0.7} hitSlop={8} style={styles.chipRemove}>
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        // Trigger button
        <TouchableOpacity
          style={[styles.trigger, disabled && styles.triggerDisabled]}
          onPress={openPicker}
          activeOpacity={0.7}
          disabled={disabled}
        >
          <Ionicons name="search-outline" size={15} color="#9CA3AF" />
          <Text style={styles.triggerText}>{placeholder}</Text>
          <Ionicons name="chevron-down" size={13} color="#9CA3AF" />
        </TouchableOpacity>
      )}

      {isDesktop ? desktopDropdown : mobileModal}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Trigger button ──────────────────────────────────────────────────────────
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
  },
  triggerDisabled: {
    opacity: 0.5,
  },
  triggerText: {
    flex: 1,
    fontSize: 14,
    color: '#9CA3AF',
  },

  // ── Selected chip ───────────────────────────────────────────────────────────
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  chipCategory: {
    fontSize: 12,
    color: '#B45309',
    flexShrink: 0,
  },
  chipRemove: {
    flexShrink: 0,
    marginLeft: 2,
  },

  // ── Desktop dropdown ────────────────────────────────────────────────────────
  desktopDropdown: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 6,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 4px 16px rgba(0,0,0,0.12)' } as any
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          elevation: 8,
        }),
  },

  // ── Mobile fullscreen ──────────────────────────────────────────────────────
  mobileFullscreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  mobileTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  // ── Shared: search bar ──────────────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    backgroundColor: '#F9FAFB',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    padding: 0,
  },

  // ── Result items ────────────────────────────────────────────────────────────
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  resultItemSelected: {
    backgroundColor: '#FFFBEB',
  },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  resultCategory: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },

  // ── Empty state ─────────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
