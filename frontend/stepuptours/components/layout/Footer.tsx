// components/layout/Footer.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../stores/auth.store';

const NAVY = '#1C2B3A';
const NAVY_LIGHT = '#243447';
const ACCENT = '#F59E0B';
const TEXT_MUTED = '#8B9EB0';
const TEXT_LIGHT = '#CBD5E1';
const TEXT_WHITE = '#FFFFFF';

interface SiteSettings {
  siteName: string;
  siteEmail: string;
  slogan: string;
  address: string;
  phone: string;
}

export default function Footer() {
  const { t } = useTranslation();
  const router = useRouter();
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const { width } = useWindowDimensions();
  const openContactModal = useAuthStore((s) => s.openContactModal);
  const isDesktop = width >= 768;

  const lang = langcode ?? 'en';

  const [settings, setSettings] = useState<SiteSettings>({
    siteName:  'StepUp Tours',
    siteEmail: 'info@stepuptours.com',
    slogan:    t('home.subtitle'),   // fallback si Drupal devuelve slogan vacío
    address:   '',
    phone:     '',
  });

  useEffect(() => {
    const base = process.env.EXPO_PUBLIC_API_URL ?? '';
    fetch(`${base}/api/site-settings`, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    })
      .then(r => r.json())
      .then((data) => {
        setSettings(prev => ({
          siteName:  data.siteName  || prev.siteName,
          siteEmail: data.siteEmail || prev.siteEmail,
          slogan:    data.slogan    || prev.slogan,
          address:   data.address   || '',
          phone:     data.phone     || '',
        }));
      })
      .catch((err) => {
        console.error('Site settings fetch error:', err);
      });
  }, []);

  const year = new Date().getFullYear();

  const navigate = (path: string) => router.push(path as any);

  return (
    <View style={styles.wrapper}>
      {/* ── Main grid ── */}
      <View style={[styles.grid, isDesktop && styles.gridDesktop]}>

        {/* Col 1 — Brand */}
        <View style={[styles.col, isDesktop && styles.colDesktop, styles.colBrand]}>
          <View style={styles.logoRow}>
            <View style={styles.logoCircle}>
              <Ionicons name="compass" size={22} color={ACCENT} />
            </View>
            <Text style={styles.brandName}>{settings.siteName}</Text>
          </View>
          <Text style={styles.brandSlogan}>{settings.slogan}</Text>

          <View style={styles.socialRow}>
            {(['logo-instagram', 'logo-facebook', 'logo-twitter'] as const).map(icon => (
              <TouchableOpacity key={icon} style={styles.socialBtn}>
                <Ionicons name={icon} size={16} color={TEXT_MUTED} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Col 2 — Quick links */}
        <View style={[styles.col, isDesktop && styles.colDesktop]}>
          <View style={styles.colHeader}>
            <Text style={styles.colTitle}>{t('footer.quickLinks')}</Text>
            <View style={styles.colUnderline} />
          </View>
          <FooterLink label={t('footer.home')}             onPress={() => navigate(`/${lang}`)} />
          <FooterLink label={t('nav.ranking')}             onPress={() => navigate(`/${lang}/ranking`)} />
          <FooterLink label={t('nav.favourites')}          onPress={() => navigate(`/${lang}/favourites`)} />
          <FooterLink label={t('nav.completed')}           onPress={() => navigate(`/${lang}/completed`)} />
        </View>

        {/* Col 3 — Legal */}
        <View style={[styles.col, isDesktop && styles.colDesktop]}>
          <View style={styles.colHeader}>
            <Text style={styles.colTitle}>Legal</Text>
            <View style={styles.colUnderline} />
          </View>
          <FooterLink
            label={t('footer.privacyPolicy')}
            onPress={() => navigate(`/${lang}/privacy-policy`)}
          />
          <FooterLink
            label={t('footer.cookiePolicy')}
            onPress={() => navigate(`/${lang}/cookie-policy`)}
          />
          <FooterLink
            label={t('footer.termsOfUse')}
            onPress={() => navigate(`/${lang}/privacy-policy`)}
          />
          <FooterLink label={t('footer.contact')} onPress={openContactModal} />
        </View>

        {/* Col 4 — Contact info */}
        <View style={[styles.col, isDesktop && styles.colDesktop]}>
          <View style={styles.colHeader}>
            <Text style={styles.colTitle}>{t('footer.contactInfo')}</Text>
            <View style={styles.colUnderline} />
          </View>
          {!!settings.siteEmail && (
            <ContactItem icon="mail-outline" text={settings.siteEmail} />
          )}
        </View>
      </View>

      {/* ── Bottom bar ── */}
      <View style={styles.bottomBar}>
        <Text style={styles.copyright}>
          © {year} {settings.siteName}. {t('footer.allRights')}
        </Text>
        <View style={styles.bottomLinks}>
          <TouchableOpacity onPress={() => navigate(`/${lang}/privacy-policy`)}>
            <Text style={styles.bottomLink}>{t('footer.privacyPolicy')}</Text>
          </TouchableOpacity>
          <Text style={styles.bottomDot}>·</Text>
          <TouchableOpacity onPress={() => navigate(`/${lang}/cookie-policy`)}>
            <Text style={styles.bottomLink}>{t('footer.cookiePolicy')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.footerLinkBtn} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name="chevron-forward" size={12} color={ACCENT} style={styles.linkChevron} />
      <Text style={styles.footerLinkText}>{label}</Text>
    </TouchableOpacity>
  );
}

function ContactItem({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.contactItem}>
      <View style={styles.contactIconCircle}>
        <Ionicons name={icon} size={14} color={ACCENT} />
      </View>
      <Text style={styles.contactText}>{text}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: NAVY,
  },

  // Grid
  grid: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
    gap: 32,
  },
  gridDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },

  // Columns
  col: {
    // mobile: stacked
  },
  colDesktop: {
    flex: 1,
    paddingHorizontal: 12,
  },
  colBrand: {
    // slightly wider on desktop
  },

  // Brand column
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: NAVY_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D3F52',
  },
  brandName: {
    color: TEXT_WHITE,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  brandSlogan: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 220,
    marginBottom: 16,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 8,
  },
  socialBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: NAVY_LIGHT,
    borderWidth: 1,
    borderColor: '#2D3F52',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Column headers
  colHeader: {
    marginBottom: 16,
  },
  colTitle: {
    color: TEXT_WHITE,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  colUnderline: {
    width: 32,
    height: 2,
    backgroundColor: ACCENT,
    borderRadius: 1,
  },

  // Footer links
  footerLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  linkChevron: {
    marginRight: 6,
  },
  footerLinkText: {
    color: TEXT_LIGHT,
    fontSize: 13,
  },

  // Contact items
  contactItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  contactIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: ACCENT + '22', // 13% opacity amber
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  contactText: {
    color: TEXT_LIGHT,
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },

  // Bottom bar
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: '#2D3F52',
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  copyright: {
    color: TEXT_MUTED,
    fontSize: 12,
  },
  bottomLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bottomLink: {
    color: TEXT_MUTED,
    fontSize: 12,
  },
  bottomDot: {
    color: TEXT_MUTED,
    fontSize: 12,
  },
});
