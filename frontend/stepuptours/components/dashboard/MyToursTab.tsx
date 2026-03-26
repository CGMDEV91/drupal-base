// components/dashboard/MyToursTab.tsx
// Lists tours authored by the current professional user.
// Uses the shared TourCard with isOwner mode for edit/delete actions.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Alert,
  Modal,
  Platform,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getToursByAuthor, deleteTour } from '../../services/dashboard.service';
import { TourCard } from '../tour/TourCard';
import type { Tour } from '../../types';

const AMBER = '#F59E0B';
const GAP = 16;

interface MyToursTabProps {
  userId: string;
}

// ── Delete confirmation modal (web) ──────────────────────────────────────────

interface DeleteModalProps {
  visible: boolean;
  tourTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteModal({ visible, tourTitle, onConfirm, onCancel }: DeleteModalProps) {
  const { t } = useTranslation();
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <Pressable style={styles.modalBackdrop} onPress={onCancel}>
        <Pressable style={styles.modalBox} onPress={() => {}}>
          <View style={styles.modalIconRow}>
            <View style={styles.modalIconBg}>
              <Ionicons name="trash-outline" size={24} color="#EF4444" />
            </View>
          </View>
          <Text style={styles.modalTitle}>{t('dashboard.tours.deleteTitle')}</Text>
          <Text style={styles.modalBody} numberOfLines={3}>
            {t('dashboard.tours.deleteConfirm', { title: tourTitle })}
          </Text>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalBtnCancel} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.modalBtnCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtnDelete} onPress={onConfirm} activeOpacity={0.8}>
              <Text style={styles.modalBtnDeleteText}>{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MyToursTab({ userId }: MyToursTabProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const { width } = useWindowDimensions();

  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Tour | null>(null);

  // ── Responsive grid ───────────────────────────────────────────────────────
  // MyToursTab lives inside dashboard's padded container (paddingHorizontal: 16,
  // maxWidth: 900). We compute available width from there, not full window width.
  const DASHBOARD_PADDING = 32; // 16px on each side from dashboard container
  const DASHBOARD_MAX = 900;
  const availableWidth = Math.min(width, DASHBOARD_MAX) - DASHBOARD_PADDING;
  const cols = availableWidth >= 700 ? 3 : availableWidth >= 480 ? 2 : 1;
  const cardWidth =
    cols === 1
      ? availableWidth
      : (availableWidth - GAP * (cols - 1)) / cols;

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadTours = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getToursByAuthor(userId);
      setTours(data);
    } catch (err: any) {
      setError(err.message ?? 'Error loading tours');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadTours();
  }, [loadTours]);

  // ── Search filtering — client-side ────────────────────────────────────────
  const filteredTours = search.trim()
    ? tours.filter((t) =>
        t.title.toLowerCase().includes(search.trim().toLowerCase())
      )
    : tours;

  // ── Delete flow ───────────────────────────────────────────────────────────
  const handleDeleteRequest = useCallback((tour: Tour) => {
    if (Platform.OS === 'web') {
      setPendingDelete(tour);
    } else {
      Alert.alert(
        t('dashboard.tours.deleteTitle'),
        t('dashboard.tours.deleteConfirm', { title: tour.title }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: () => confirmDelete(tour.id),
          },
        ]
      );
    }
  }, [t]);

  const confirmDelete = useCallback(async (tourId: string) => {
    setPendingDelete(null);
    setDeletingId(tourId);
    try {
      await deleteTour(tourId);
      setTours((prev) => prev.filter((t) => t.id !== tourId));
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message ?? 'Failed to delete tour');
    } finally {
      setDeletingId(null);
    }
  }, [t]);

  const handleEdit = useCallback((tour: Tour) => {
    router.push(
      `/${langcode}/dashboard/create-tour?tourId=${tour.id}` as any
    );
  }, [router, langcode]);

  // ── States ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadTours} activeOpacity={0.8}>
          <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── List header: Create button + Search bar ───────────────────────────────
  const ListHeader = (
    <View style={styles.listHeader}>
      <TouchableOpacity
        style={styles.createBtn}
        activeOpacity={0.85}
        onPress={() => router.push(`/${langcode}/dashboard/create-tour` as any)}
      >
        <Ionicons name="add" size={18} color="#FFFFFF" />
        <Text style={styles.createBtnText}>{t('dashboard.tours.create')}</Text>
      </TouchableOpacity>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t('dashboard.tours.searchPlaceholder')}
          placeholderTextColor="#9CA3AF"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  return (
    <>
      {/* Header: create button + search */}
      {ListHeader}

      {filteredTours.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="map-outline" size={56} color="#D1D5DB" />
          <Text style={styles.emptyText}>
            {search.trim()
              ? t('dashboard.tours.noResults')
              : t('dashboard.tours.empty')}
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {filteredTours.map((item) => (
            <View key={item.id} style={{ width: cardWidth, position: 'relative' }}>
              <TourCard
                tour={item}
                cardWidth={cardWidth}
                langcode={langcode ?? 'en'}
                isOwner={true}
                onEdit={() => handleEdit(item)}
                onDelete={() => handleDeleteRequest(item)}
              />
              {deletingId === item.id ? (
                <View style={[StyleSheet.absoluteFill, styles.deletingOverlay]}>
                  <ActivityIndicator size="small" color={AMBER} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {/* Web delete confirmation modal */}
      <DeleteModal
        visible={pendingDelete !== null}
        tourTitle={pendingDelete?.title ?? ''}
        onConfirm={() => pendingDelete && confirmDelete(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 48,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryBtn: {
    backgroundColor: AMBER,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },

  // ── Grid ───────────────────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingBottom: 16,
  },

  // ── List header ────────────────────────────────────────────────────────────
  listHeader: {
    width: '100%',
    paddingTop: 4,
    paddingBottom: 20,
    gap: 12,
  },

  // ── Create button ──────────────────────────────────────────────────────────
  createBtn: {
    backgroundColor: AMBER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    gap: 6,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // ── Search bar ─────────────────────────────────────────────────────────────
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' } as any
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 1,
        }),
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    padding: 0,
  },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '500',
    textAlign: 'center',
  },

  // ── Deleting overlay ───────────────────────────────────────────────────────
  deletingOverlay: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Web delete modal ───────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    gap: 12,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 32px rgba(0,0,0,0.18)' } as any
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 24,
          elevation: 12,
        }),
  },
  modalIconRow: {
    alignItems: 'center',
    marginBottom: 4,
  },
  modalIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalBtnCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalBtnCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  modalBtnDelete: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalBtnDeleteText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
