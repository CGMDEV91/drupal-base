import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function SubscriptionComplete() {
  const { session_id } = useLocalSearchParams<{ session_id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const langcode = pathname.split('/').filter(Boolean)[0] ?? 'es';
  const { t } = useTranslation();
  const [countdown, setCountdown] = React.useState(5);
  const hasRedirected = useRef(false);

  const goToDashboard = () => {
    if (hasRedirected.current) return;
    hasRedirected.current = true;
    router.replace(`/${langcode}/dashboard` as any);
  };

  useEffect(() => {
    if (!session_id) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Usar setTimeout para ejecutar fuera del ciclo de render
          setTimeout(() => goToDashboard(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [session_id]);

  if (!session_id) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle" size={64} color="#EF4444" />
        <Text style={styles.title}>{t('subscription.complete.sessionNotFound')}</Text>
        <TouchableOpacity style={styles.btn} onPress={goToDashboard}>
          <Text style={styles.btnText}>{t('subscription.complete.backToDashboard')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.centered}>
      <Ionicons name="checkmark-circle" size={64} color="#16A34A" />
      <Text style={styles.title}>{t('subscription.complete.paymentComplete')}</Text>
      <Text style={styles.text}>{t('subscription.complete.activating', { countdown })}</Text>
      <TouchableOpacity style={styles.btn} onPress={goToDashboard}>
        <Text style={styles.btnText}>{t('subscription.complete.goNow')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
    backgroundColor: '#FFFFFF',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center' },
  text: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  btn: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
