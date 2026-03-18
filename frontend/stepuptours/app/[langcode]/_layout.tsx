// app/[langcode]/_layout.tsx
// Valida el langcode de la URL, sincroniza stores, renderiza Navbar + Footer

import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Slot, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useLanguageStore } from '../../stores/language.store';
import { AuthModals } from '../../components/layout/AuthModals';
import { Navbar } from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import ContactModal from '../../components/layout/ContactModal';

export default function LangcodeLayout() {
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const languages = useLanguageStore((s) => s.languages);
  const currentLanguage = useLanguageStore((s) => s.currentLanguage);
  const setLanguageByCode = useLanguageStore((s) => s.setLanguageByCode);
  const router = useRouter();
  const segments = useSegments();

  // Auth modal state
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null);
  // Contact modal state
  const [contactVisible, setContactVisible] = useState(false);

  // Validar y sincronizar langcode
  useEffect(() => {
    if (!langcode || languages.length === 0) return;

    const isValid = languages.some((l) => l.id === langcode);
    if (!isValid) {
      const restPath = segments.slice(1).join('/');
      router.replace(`/en/${restPath}` as any);
      return;
    }

    if (currentLanguage?.id !== langcode) {
      setLanguageByCode(langcode);
    }
  }, [langcode, languages]);

  return (
    <View style={{ flex: 1 }}>
      <Navbar onOpenAuth={(mode) => setAuthModal(mode)} />

      <View style={{ flex: 1 }}>
        <Slot />
      </View>

      <Footer onOpenContact={() => setContactVisible(true)} />

      <AuthModals
        visible={authModal}
        onClose={() => setAuthModal(null)}
        onSwitch={(mode) => setAuthModal(mode)}
      />
      <ContactModal
        visible={contactVisible}
        onClose={() => setContactVisible(false)}
      />
    </View>
  );
}
