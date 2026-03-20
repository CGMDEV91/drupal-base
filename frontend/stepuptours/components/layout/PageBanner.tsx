// components/layout/PageBanner.tsx
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BackButton from './BackButton';

interface PageBannerProps {
  icon: string;
  iconBgColor: string;
  title: string;
  subtitle?: string;
  showBack?: boolean;
}

export default function PageBanner({
  icon,
  iconBgColor,
  title,
  subtitle,
  showBack = true,
}: PageBannerProps) {
  return (
    <View style={styles.banner}>
      {showBack && (
        <View style={styles.backButtonContainer}>
          <BackButton />
        </View>
      )}
      <View style={[styles.iconCircle, { backgroundColor: iconBgColor }]}>
        <Ionicons name={icon as any} size={28} color="#FFFFFF" />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#1E293B',
    minHeight: 180,
    paddingTop: 20,
    paddingBottom: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
});
