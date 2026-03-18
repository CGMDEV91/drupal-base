// components/layout/Navbar.tsx
import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/auth.store';
import { LanguageSelector } from './LanguageSelector';

interface NavbarProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function Navbar({ onOpenAuth }: NavbarProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const lang = langcode || 'en';

  const handleNavigate = useCallback(
    (path: string) => {
      setUserMenuOpen(false);
      setMobileMenuOpen(false);
      router.push(path as any);
    },
    [router],
  );

  const handleSignOut = useCallback(async () => {
    setUserMenuOpen(false);
    await signOut();
  }, [signOut]);

  const handleLogoPress = useCallback(() => {
    router.push(`/${lang}` as any);
  }, [router, lang]);

  // ── Logo ──────────────────────────────────────────────
  const logo = (
    <TouchableOpacity
      onPress={handleLogoPress}
      activeOpacity={0.7}
      style={styles.logoContainer}
    >
      <Text style={styles.logoEmoji}>🧭</Text>
      <Text style={styles.logoText}>StepUp Tours</Text>
    </TouchableOpacity>
  );

  // ── Anonymous: desktop buttons ────────────────────────
  const anonDesktop = (
    <View style={styles.row}>
      <LanguageSelector />
      <TouchableOpacity
        onPress={() => onOpenAuth('login')}
        activeOpacity={0.7}
        style={styles.signInButton}
      >
        <Text style={styles.signInText}>{t('nav.signin')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onOpenAuth('register')}
        activeOpacity={0.7}
        style={styles.registerButton}
      >
        <Text style={styles.registerText}>{t('nav.register')}</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Anonymous: mobile hamburger ───────────────────────
  const anonMobile = (
    <View style={styles.row}>
      <LanguageSelector />
      <TouchableOpacity
        onPress={() => setMobileMenuOpen((v) => !v)}
        activeOpacity={0.7}
        style={styles.hamburger}
      >
        <Text style={styles.hamburgerIcon}>☰</Text>
      </TouchableOpacity>
    </View>
  );

  const mobileDropdown = mobileMenuOpen && (
    <View style={styles.dropdownOverlay}>
      <Pressable style={styles.dropdownBackdrop} onPress={() => setMobileMenuOpen(false)} />
      <View style={[styles.dropdown, styles.dropdownRight]}>
        <TouchableOpacity
          onPress={() => {
            setMobileMenuOpen(false);
            onOpenAuth('login');
          }}
          activeOpacity={0.7}
          style={styles.dropdownItem}
        >
          <Text style={styles.dropdownItemText}>{t('nav.signin')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setMobileMenuOpen(false);
            onOpenAuth('register');
          }}
          activeOpacity={0.7}
          style={styles.dropdownItem}
        >
          <Text style={styles.dropdownItemText}>{t('nav.register')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Authenticated: avatar + dropdown ──────────────────
  const initials = user ? getInitials(user.publicName) : '';
  const roles = user?.roles ?? [];

  const userAvatar = (
    <View style={styles.row}>
      <LanguageSelector />
      <TouchableOpacity
        onPress={() => setUserMenuOpen((v) => !v)}
        activeOpacity={0.7}
        style={styles.avatar}
      >
        <Text style={styles.avatarText}>{initials}</Text>
      </TouchableOpacity>
    </View>
  );

  const userDropdown = userMenuOpen && (
    <View style={styles.dropdownOverlay}>
      <Pressable style={styles.dropdownBackdrop} onPress={() => setUserMenuOpen(false)} />
      <View style={[styles.dropdown, styles.dropdownRight]}>
        <TouchableOpacity
          onPress={() => handleNavigate(`/${lang}/favourites`)}
          activeOpacity={0.7}
          style={styles.dropdownItem}
        >
          <Text style={styles.dropdownItemText}>{t('nav.favourites')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleNavigate(`/${lang}/completed`)}
          activeOpacity={0.7}
          style={styles.dropdownItem}
        >
          <Text style={styles.dropdownItemText}>{t('nav.completed')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleNavigate(`/${lang}/ranking`)}
          activeOpacity={0.7}
          style={styles.dropdownItem}
        >
          <Text style={styles.dropdownItemText}>{t('nav.ranking')}</Text>
        </TouchableOpacity>
        {roles.includes('administrator') && (
          <TouchableOpacity
            onPress={() => handleNavigate(`/${lang}/admin`)}
            activeOpacity={0.7}
            style={styles.dropdownItem}
          >
            <Text style={styles.dropdownItemText}>{t('nav.administration')}</Text>
          </TouchableOpacity>
        )}
        {roles.includes('professional') && (
          <TouchableOpacity
            onPress={() => handleNavigate(`/${lang}/dashboard`)}
            activeOpacity={0.7}
            style={styles.dropdownItem}
          >
            <Text style={styles.dropdownItemText}>{t('nav.dashboard')}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.dropdownDivider} />
        <TouchableOpacity
          onPress={handleSignOut}
          activeOpacity={0.7}
          style={styles.dropdownItem}
        >
          <Text style={[styles.dropdownItemText, styles.signOutText]}>
            {t('nav.signout')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Render ────────────────────────────────────────────
  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        {logo}
        {user ? userAvatar : isDesktop ? anonDesktop : anonMobile}
      </View>
      {!user && !isDesktop && mobileDropdown}
      {user && userDropdown}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  // Logo
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoEmoji: {
    fontSize: 24,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#D97706',
  },

  // Shared row for right-side items
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  // Sign In button (outlined)
  signInButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  signInText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D97706',
  },

  // Register button (filled)
  registerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
  },
  registerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Hamburger
  hamburger: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  hamburgerIcon: {
    fontSize: 22,
    color: '#D97706',
  },

  // Avatar
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Dropdown overlay (positioned absolutely below the header)
  dropdownOverlay: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
    ...(Platform.OS === 'web'
      ? { position: 'absolute' as any, height: '100vh' as any }
      : { height: 9999 }),
  },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  dropdown: {
    position: 'absolute',
    top: 4,
    minWidth: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  dropdownRight: {
    right: 16,
  },

  // Dropdown items
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  signOutText: {
    color: '#DC2626',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 12,
  },
});
