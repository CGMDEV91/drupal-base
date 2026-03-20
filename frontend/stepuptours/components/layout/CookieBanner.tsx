// components/layout/CookieBanner.tsx
// GDPR cookie consent banner — fixed at the bottom of the screen, does not affect layout flow.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

const CONSENT_KEY = 'cookie_consent';

// Cross-platform storage: use localStorage on web, in-memory fallback on native
// (AsyncStorage is not installed; add it to the project later for native persistence)
const storage = Platform.OS === 'web'
  ? {
      getItem: (key: string): Promise<string | null> =>
        Promise.resolve(
          typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
        ),
      setItem: (key: string, value: string): Promise<void> =>
        Promise.resolve(
          typeof localStorage !== 'undefined' ? localStorage.setItem(key, value) : undefined
        ),
    }
  : (() => {
      // In-memory fallback for native until AsyncStorage is added
      const mem: Record<string, string> = {};
      return {
        getItem: (key: string) => Promise.resolve(mem[key] ?? null),
        setItem: (key: string, value: string) => {
          mem[key] = value;
          return Promise.resolve();
        },
      };
    })();

export default function CookieBanner() {
  const { t } = useTranslation();
  const router = useRouter();
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    storage
      .getItem(CONSENT_KEY)
      .then((val) => {
        if (val === null) setVisible(true);
      })
      .catch(() => setVisible(true));
  }, []);

  const handleAccept = async () => {
    await storage.setItem(CONSENT_KEY, 'accepted');
    setVisible(false);
  };

  const handleDecline = async () => {
    await storage.setItem(CONSENT_KEY, 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={[styles.content, isDesktop && styles.contentDesktop]}>
        {/* Text */}
        <Text style={[styles.text, isDesktop && styles.textDesktop]}>
          {t('cookie.banner.text')}{' '}
          <Text
            style={styles.link}
            onPress={() =>
              router.push(`/${langcode ?? 'en'}/cookie-policy` as any)
            }
          >
            {t('cookie.banner.learnMore')}
          </Text>
        </Text>

        {/* Buttons */}
        <View style={[styles.buttons, isDesktop && styles.buttonsDesktop]}>
          <TouchableOpacity
            style={styles.declineBtn}
            onPress={handleDecline}
            accessibilityRole="button"
            accessibilityLabel={t('cookie.banner.decline')}
          >
            <Text style={styles.declineBtnText}>{t('cookie.banner.decline')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={handleAccept}
            accessibilityRole="button"
            accessibilityLabel={t('cookie.banner.agree')}
          >
            <Text style={styles.acceptBtnText}>{t('cookie.banner.agree')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fixed overlay at the bottom — does NOT push page content up
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1F2937',
    // Shadow for elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 20,
    zIndex: 9999,
  },

  // Mobile: column layout
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'column',
    gap: 12,
  },

  // Desktop: row layout
  contentDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    gap: 24,
  },

  text: {
    color: '#E5E7EB',
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
  },

  textDesktop: {
    flex: 1,
  },

  link: {
    color: '#F59E0B',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },

  // Mobile: row with gap
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },

  // Desktop: keep buttons together on the right side
  buttonsDesktop: {
    flexShrink: 0,
  },

  declineBtn: {
    borderWidth: 1,
    borderColor: '#6B7280',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },

  declineBtnText: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
  },

  acceptBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },

  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
