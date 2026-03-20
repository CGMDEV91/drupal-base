// app/[langcode]/_layout.tsx
// Valida el langcode de la URL, sincroniza stores, renderiza Navbar

import { useEffect } from 'react';
import { View } from 'react-native';
import { Slot, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useLanguageStore } from '../../stores/language.store';
import { useAuthStore } from '../../stores/auth.store';
import { AuthModals } from '../../components/layout/AuthModals';
import { Navbar } from '../../components/layout/Navbar';
import ContactModal from '../../components/layout/ContactModal';
import CookieBanner from '../../components/layout/CookieBanner';

export default function LangcodeLayout() {
  const { langcode } = useLocalSearchParams<{ langcode: string }>();
  const languages = useLanguageStore((s) => s.languages);
  const currentLanguage = useLanguageStore((s) => s.currentLanguage);
  const setLanguageByCode = useLanguageStore((s) => s.setLanguageByCode);
  const router = useRouter();
  const segments = useSegments();

  // Auth modal state — driven by Zustand so any page can trigger it
  const pendingAuthModal = useAuthStore((s) => s.pendingAuthModal);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const closeAuthModal = useAuthStore((s) => s.closeAuthModal);

  // Contact modal state — driven by Zustand so Footer (in pages) can trigger it
  const contactModalOpen = useAuthStore((s) => s.contactModalOpen);
  const closeContactModal = useAuthStore((s) => s.closeContactModal);

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
      <Navbar onOpenAuth={(mode) => openAuthModal(mode)} />

      <View style={{ flex: 1 }}>
        <Slot />
      </View>

      <AuthModals
        visible={pendingAuthModal}
        onClose={closeAuthModal}
        onSwitch={(mode) => openAuthModal(mode)}
      />
      <ContactModal
        visible={contactModalOpen}
        onClose={closeContactModal}
      />

      {/* Cookie consent banner — position: absolute, renders above content */}
      <CookieBanner />
    </View>
  );
}
