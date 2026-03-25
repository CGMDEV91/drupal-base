// app/[langcode]/admin.tsx
// Administration page — tab navigation for administrator role only

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
import { SiteSettingsTab } from '../../components/admin/SiteSettingsTab';
import { TranslationsTab } from '../../components/admin/TranslationsTab';
import { DonationsView } from '../../components/shared/DonationsView';
import { BusinessTab } from '../../components/dashboard/BusinessTab';
import PageBanner from '../../components/layout/PageBanner';

const AMBER = '#F59E0B';
const CONTENT_MAX_WIDTH = 900;

type TabId = 'settings' | 'translations' | 'businesses' | 'donations' | 'users';

interface Tab {
  id: TabId;
  labelKey: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'settings', labelKey: 'admin.tabs.settings', icon: 'settings-outline' },
  { id: 'translations', labelKey: 'admin.tabs.translations', icon: 'language-outline' },
  { id: 'businesses', labelKey: 'admin.tabs.businesses', icon: 'business-outline' },
  { id: 'donations', labelKey: 'admin.tabs.donations', icon: 'cash-outline' },
  { id: 'users', labelKey: 'admin.tabs.users', icon: 'people-outline' },
];

export default function AdminScreen() {
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const [activeTab, setActiveTab] = useState<TabId>('settings');

  const isAdmin = user?.roles?.includes('administrator');

  useEffect(() => {
    if (!isAuthLoading && (!user || !isAdmin)) {
      const timer = setTimeout(() => {
        router.replace(`/${langcode}` as any);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, isAuthLoading, isAdmin, langcode]);

  if (isAuthLoading || !user || !isAdmin) {
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

  const renderContent = () => {
    switch (activeTab) {
      case 'settings':
        return <SiteSettingsTab />;
      case 'translations':
        return <TranslationsTab />;
      case 'businesses':
        return <BusinessTab />;
      case 'donations':
        return <DonationsView mode="admin" />;
      case 'users':
        return (
          <View style={styles.placeholder}>
            <Ionicons name="people-outline" size={48} color="#D1D5DB" />
            <Text style={styles.placeholderText}>Coming soon</Text>
          </View>
        );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {isMobile ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 48 }}
        >
          <PageBanner
            icon="shield-checkmark-outline"
            iconBgColor="#1E293B"
            title={t('admin.title')}
            subtitle="Manage site settings and content"
            showBack={false}
          />
          {mobileTabBar}
          <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
            {renderContent()}
          </View>
        </ScrollView>
      ) : (
        <>
          {desktopTabBar}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 48 }}
          >
            <PageBanner
              icon="shield-checkmark-outline"
              iconBgColor="#1E293B"
              title={t('admin.title')}
              subtitle="Manage site settings and content"
              showBack={false}
            />
            <View style={{ maxWidth: CONTENT_MAX_WIDTH, width: '100%', alignSelf: 'center', paddingHorizontal: 16, paddingTop: 20 }}>
              {renderContent()}
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
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  placeholderText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '500',
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
