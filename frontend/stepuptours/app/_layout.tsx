import "../global.css";
import "../i18n";
import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { PortalHost } from "@rn-primitives/portal";
import { useAuthStore } from "../stores/auth.store";
import { useLanguageStore } from "../stores/language.store";

export default function RootLayout() {
  const restore = useAuthStore((s) => s.restore);
  const fetchLanguages = useLanguageStore((s) => s.fetchLanguages);
  const languages = useLanguageStore((s) => s.languages);
  const router = useRouter();
  const segments = useSegments();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    Promise.all([restore(), fetchLanguages()]).then(() => {
      setInitialized(true);
    });
  }, []);

  // Redirigir / → /en/ cuando no hay segmento de langcode
  useEffect(() => {
    if (!initialized || languages.length === 0) return;

    const firstSegment = segments[0];
    if (!firstSegment) {
      router.replace("/en/");
    }
  }, [initialized, segments, languages]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <PortalHost />
    </>
  );
}
