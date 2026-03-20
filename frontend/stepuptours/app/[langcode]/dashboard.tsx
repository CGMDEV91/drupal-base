// app/[langcode]/dashboard.tsx
// Professional Dashboard — tab navigation for professional role only

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/auth.store';
import { MyToursTab } from '../../components/dashboard/MyToursTab';
import { SubscriptionTab } from '../../components/dashboard/SubscriptionTab';
import { PaymentDataTab } from '../../components/dashboard/PaymentDataTab';
import { DonationsTab } from '../../components/dashboard/DonationsTab';
import PageBanner from '../../components/layout/PageBanner';

const AMBER = '#F59E0B';
const CONTENT_MAX_WIDTH = 900;

type TabId = 'tours' | 'subscription' | 'payment' | 'donations';

interface Tab {
  id: TabId;
  labelKey: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'tours', labelKey: 'dashboard.tabs.tours', icon: 'map-outline' },
  { id: 'subscription', labelKey: 'dashboard.tabs.subscription', icon: 'card-outline' },
  { id: 'payment', labelKey: 'dashboard.tabs.payment', icon: 'wallet-outline' },
  { id: 'donations', labelKey: 'dashboard.tabs.donations', icon: 'heart-outline' },
];

export default function DashboardScreen() {
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const [activeTab, setActiveTab] = useState<TabId>('tours');

  const isProfessional = user?.roles?.includes('professional');

  useEffect(() => {
    if (!isAuthLoading && (!user || !isProfessional)) {
      router.replace(`/${langcode}` as any);
    }
  }, [user, isAuthLoading, isProfessional, langcode]);

  if (isAuthLoading || !user || !isProfessional) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={AMBER} />
      </View>
    );
  }

  // ── Tab bar mobile: columna vertical ─────────────────────────────────────
  const mobileTabBar = (
    <View style={styles.mobileTabBar}>
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.mobileTabItem, isActive && styles.mobileTabItemActive]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={isActive ? '#FFFFFF' : '#6B7280'}
            />
            <Text style={[styles.mobileTabLabel, isActive && styles.mobileTabLabelActive]}>
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── Tab bar desktop: pills horizontales ───────────────────────────────────
  const desktopTabBar = (
    <View style={styles.tabBarWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabPill, isActive && styles.tabPillActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab.icon as any}
                size={16}
                color={isActive ? '#FFFFFF' : '#6B7280'}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {t(tab.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <PageBanner icon="briefcase" iconBgColor="#F59E0B" title={t('dashboard.title')} />

      {isMobile ? (
        // ── Mobile: columna de tabs + contenido en scroll único ──────────
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {mobileTabBar}
          <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
            {activeTab === 'tours' && <MyToursTab userId={user.id} />}
            {activeTab === 'subscription' && <SubscriptionTab userId={user.id} />}
            {activeTab === 'payment' && <PaymentDataTab userId={user.id} />}
            {activeTab === 'donations' && <DonationsTab userId={user.id} />}
          </View>
        </ScrollView>
      ) : (
        // ── Desktop: pills sticky + contenido en scroll ───────────────────
        <>
          {desktopTabBar}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 48 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ maxWidth: CONTENT_MAX_WIDTH, width: '100%', alignSelf: 'center', paddingHorizontal: 16, paddingTop: 20 }}>
              {activeTab === 'tours' && <MyToursTab userId={user.id} />}
              {activeTab === 'subscription' && <SubscriptionTab userId={user.id} />}
              {activeTab === 'payment' && <PaymentDataTab userId={user.id} />}
              {activeTab === 'donations' && <DonationsTab userId={user.id} />}
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },

  // ── Desktop tab bar ───────────────────────────────────────────────────────
  tabBarWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  tabPillActive: {
    backgroundColor: AMBER,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },

  // ── Mobile tab bar ────────────────────────────────────────────────────────
  mobileTabBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 4,
  },
  mobileTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  mobileTabItemActive: {
    backgroundColor: AMBER,
  },
  mobileTabLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  mobileTabLabelActive: {
    color: '#FFFFFF',
  },
});