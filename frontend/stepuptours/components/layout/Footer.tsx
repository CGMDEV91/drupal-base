// components/layout/Footer.tsx
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';

interface FooterProps {
  onOpenContact: () => void;
}

export default function Footer({ onOpenContact }: FooterProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      {/* Column 1: Brand */}
      <View style={[styles.column, isDesktop && styles.columnDesktop]}>
        <Text style={styles.brand}>StepUp Tours</Text>
        <Text style={styles.subtitle}>Self-guided tours worldwide</Text>
      </View>

      {/* Column 2: Contact */}
      <View style={[styles.column, isDesktop && styles.columnDesktop]}>
        <TouchableOpacity onPress={onOpenContact}>
          <Text style={styles.link}>{t('footer.contact')}</Text>
        </TouchableOpacity>
      </View>

      {/* Column 3: Legal */}
      <View style={[styles.column, isDesktop && styles.columnDesktop]}>
        <TouchableOpacity
          onPress={() => router.push(`/${langcode}/cookie-policy` as any)}
        >
          <Text style={styles.link}>{t('footer.cookiePolicy')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push(`/${langcode}/privacy-policy` as any)}
        >
          <Text style={[styles.link, styles.linkSpacing]}>
            {t('footer.privacyPolicy')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1F2937',
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  containerDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  column: {
    marginBottom: 16,
  },
  columnDesktop: {
    flex: 1,
    marginBottom: 0,
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 2,
  },
  link: {
    color: '#D1D5DB',
    fontSize: 14,
  },
  linkSpacing: {
    marginTop: 6,
  },
});
