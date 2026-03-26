// components/dashboard/BusinessTab.tsx
// Lists and manages businesses for professional (own) or admin (all)

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getBusinessesByAuthor,
  getAllBusinesses,
  deleteBusiness,
} from '../../services/business.service';
import type { Business } from '../../types';

const AMBER = '#F59E0B';
const AMBER_DARK = '#D97706';

interface BusinessTabProps {
  /** When provided, only this user's businesses are shown (professional mode) */
  userId?: string;
}

export function BusinessTab({ userId }: BusinessTabProps) {
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadBusinesses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = userId
        ? await getBusinessesByAuthor(userId)
        : await getAllBusinesses();
      setBusinesses(data);
    } catch (err: any) {
      setError(err.message ?? 'Error loading businesses');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Reload the list every time this tab comes into focus (e.g. after navigating
  // back from the create-business page).
  useFocusEffect(
    useCallback(() => {
      loadBusinesses();
    }, [loadBusinesses])
  );

  const navigateToCreate = useCallback(() => {
    router.push(`/${langcode}/dashboard/create-business` as any);
  }, [router, langcode]);

  const navigateToEdit = useCallback(
    (business: Business) => {
      router.push(
        `/${langcode}/dashboard/create-business?businessId=${business.id}` as any
      );
    },
    [router, langcode]
  );

  const confirmDelete = useCallback(
    (business: Business) => {
      const doDelete = async () => {
        setDeletingId(business.id);
        try {
          await deleteBusiness(business.id);
          setBusinesses((prev) => prev.filter((b) => b.id !== business.id));
        } catch (err: any) {
          if (Platform.OS !== 'web') {
            Alert.alert('Error', err.message ?? 'Could not delete business');
          } else {
            setError(err.message ?? 'Could not delete business');
          }
        } finally {
          setDeletingId(null);
        }
      };

      if (Platform.OS === 'web') {
        // eslint-disable-next-line no-restricted-globals
        if (confirm(`Delete "${business.name}"? This cannot be undone.`)) {
          doDelete();
        }
      } else {
        Alert.alert(
          'Delete Business',
          `Delete "${business.name}"? This cannot be undone.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: doDelete },
          ]
        );
      }
    },
    []
  );

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
        <TouchableOpacity style={styles.retryBtn} onPress={loadBusinesses} activeOpacity={0.8}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Create button */}
      <TouchableOpacity
        style={styles.createBtn}
        activeOpacity={0.85}
        onPress={navigateToCreate}
      >
        <Ionicons name="add" size={18} color="#FFFFFF" />
        <Text style={styles.createBtnText}>Create Business</Text>
      </TouchableOpacity>

      {businesses.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={56} color="#D1D5DB" />
          <Text style={styles.emptyText}>No businesses yet</Text>
        </View>
      ) : isDesktop ? (
        // ── Desktop: table layout ──────────────────────────────────────────
        <View style={styles.tableWrapper}>
          {/* Table header */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.colName, styles.tableHeaderText]}>
              Name
            </Text>
            <Text style={[styles.tableCell, styles.colCategory, styles.tableHeaderText]}>
              Category
            </Text>
            <Text style={[styles.tableCell, styles.colWebsite, styles.tableHeaderText]}>
              Website
            </Text>
            <View style={[styles.tableCell, styles.colActions]} />
          </View>

          {/* Rows */}
          {businesses.map((business) => (
            <View key={business.id} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colName, styles.rowTitle]} numberOfLines={1}>
                {business.name}
              </Text>
              <Text style={[styles.tableCell, styles.colCategory, styles.rowMeta]} numberOfLines={1}>
                {business.category?.name ?? '—'}
              </Text>
              <Text style={[styles.tableCell, styles.colWebsite, styles.rowMeta]} numberOfLines={1}>
                {business.website
                  ? business.website.replace(/^https?:\/\/(www\.)?/, '')
                  : '—'}
              </Text>
              <View style={[styles.tableCell, styles.colActions, styles.rowActions]}>
                <TouchableOpacity
                  style={styles.actionEdit}
                  onPress={() => navigateToEdit(business)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="pencil-outline" size={14} color="#6B7280" />
                  <Text style={styles.actionEditText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionDelete}
                  onPress={() => confirmDelete(business)}
                  disabled={deletingId === business.id}
                  activeOpacity={0.8}
                >
                  {deletingId === business.id ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={14} color="#EF4444" />
                      <Text style={styles.actionDeleteText}>Delete</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : (
        // ── Mobile: card stack ────────────────────────────────────────────
        <View style={styles.cardList}>
          {businesses.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              deleting={deletingId === business.id}
              onEdit={() => navigateToEdit(business)}
              onDelete={() => confirmDelete(business)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Mobile card ───────────────────────────────────────────────────────────────

interface BusinessCardProps {
  business: Business;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function BusinessCard({ business, deleting, onEdit, onDelete }: BusinessCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIconWrap}>
          <Ionicons name="business-outline" size={20} color={AMBER} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>
            {business.name}
          </Text>
          {business.category ? (
            <Text style={styles.cardCategory}>{business.category.name}</Text>
          ) : null}
        </View>
      </View>

      {business.website ? (
        <Text style={styles.cardWebsite} numberOfLines={1}>
          {business.website.replace(/^https?:\/\/(www\.)?/, '')}
        </Text>
      ) : null}

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionEdit}
          onPress={onEdit}
          activeOpacity={0.8}
        >
          <Ionicons name="pencil-outline" size={14} color="#6B7280" />
          <Text style={styles.actionEditText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionDelete}
          onPress={onDelete}
          disabled={deleting}
          activeOpacity={0.8}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={14} color="#EF4444" />
              <Text style={styles.actionDeleteText}>Delete</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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

  // Create button
  createBtn: {
    backgroundColor: AMBER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 20,
    gap: 6,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Desktop table
  tableWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 30,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  tableHeader: {
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableCell: {
    paddingHorizontal: 6,
  },
  colName: {
    flex: 3,
  },
  colCategory: {
    flex: 2,
  },
  colWebsite: {
    flex: 3,
  },
  colActions: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  rowMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
  rowActions: {
    alignItems: 'center',
  },

  // Shared action buttons
  actionEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionEditText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  actionDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF5F5',
  },
  actionDeleteText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },

  // Mobile cards
  cardList: {
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 10,
    marginBottom: 30,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  cardCategory: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  cardWebsite: {
    fontSize: 13,
    color: '#3B82F6',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
});
