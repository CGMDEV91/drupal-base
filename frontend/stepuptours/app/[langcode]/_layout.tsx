// app/[langcode]/_layout.tsx
// Valida el langcode de la URL, sincroniza stores, renderiza Navbar
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Slot, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useLanguageStore } from '../../stores/language.store';
import { useAuthStore } from '../../stores/auth.store';
import { AuthModals } from '../../components/layout/AuthModals';
import { Navbar } from '../../components/layout/Navbar';
import ContactModal from '../../components/layout/ContactModal';
import CookieBanner from '../../components/layout/CookieBanner';

// Module-level: survives component remounts when the user changes langcode.
// Tracks for which user.id we already applied the preferred-language redirect,
// so we never redirect again after the user manually switches language.
let preferredLangAppliedForUserId: string | null = null;

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

  // Contact modal state — driven by Zustand so Footer can trigger it
  const contactModalOpen = useAuthStore((s) => s.contactModalOpen);
  const closeContactModal = useAuthStore((s) => s.closeContactModal);

  // Auth state for logout redirect
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);

  // ── Guard: no navegar hasta que el Root Layout esté montado ──────────────
  // router.replace() llamado en el primer render (o síncrono con él) lanza
  // "Attempted to navigate before mounting the Root Layout". El estado `ready`
  // garantiza que cualquier navegación ocurre como mínimo en el segundo ciclo.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);

  // Validar y sincronizar langcode
  useEffect(() => {
    if (!ready) return;
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
  }, [ready, langcode, languages]);

  // Redirect to home after logout from protected pages
  useEffect(() => {
    if (!ready) return;
    if (!isAuthLoading && !user && langcode) {
      const protectedSegments = ['profile', 'favourites', 'completed', 'dashboard', 'steps'];
      const currentSegment = segments[segments.length - 1];
      if (protectedSegments.includes(currentSegment)) {
        router.replace(`/${langcode}` as any);
      }
    }
  }, [ready, user, isAuthLoading, langcode, segments]);

  // Redirect to the user's preferred language on login / session restore.
  // The module-level variable (not a useRef) ensures the check survives remounts
  // when the user manually changes langcode — so we never override a manual choice.
  useEffect(() => {
    if (!ready || !user || languages.length === 0) return;
    if (preferredLangAppliedForUserId === user.id) return; // Already applied for this user

    preferredLangAppliedForUserId = user.id;

    const preferredLang = user.preferredLanguage;
    if (!preferredLang || preferredLang === langcode) return;

    const isAvailable = languages.some((l) => l.id === preferredLang);
    if (!isAvailable) return;

    setLanguageByCode(preferredLang);
    const restPath = segments.slice(1).join('/');
    router.replace(`/${preferredLang}/${restPath}` as any);
  }, [ready, user?.id, languages]);

  // Reset on logout so the redirect applies again on next login.
  useEffect(() => {
    if (!user) preferredLangAppliedForUserId = null;
  }, [user?.id]);

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
