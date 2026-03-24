import "../global.css";
import "../i18n";
import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { PortalHost } from "@rn-primitives/portal";
import { useAuthStore } from "../stores/auth.store";
import { useLanguageStore } from "../stores/language.store";

// ── Scroll listener (solo web) ────────────────────────────────────────────
function setupScrollBehavior() {
  if (typeof document === "undefined") return;

  let timeouts = new WeakMap<Element, ReturnType<typeof setTimeout>>();

  function onScroll(e: Event) {
    const target = e.target as Element;
    if (!target || typeof target.setAttribute !== "function") return;

    // Marcar el elemento como scrolling
    target.setAttribute("data-scrolling", "true");

    // Limpiar timeout anterior si existe
    const prev = timeouts.get(target);
    if (prev) clearTimeout(prev);

    // Quitar el atributo tras 2 segundos de inactividad
    const t = setTimeout(() => {
      target.removeAttribute("data-scrolling");
      timeouts.delete(target);
    }, 2000);

    timeouts.set(target, t);
  }

  // Capturar scroll en cualquier elemento scrollable de la página
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });

  return () => {
    document.removeEventListener("scroll", onScroll, { capture: true });
  };
}

export default function RootLayout() {
  const restore = useAuthStore((s) => s.restore);
  const fetchLanguages = useLanguageStore((s) => s.fetchLanguages);
  const languages = useLanguageStore((s) => s.languages);
  const router = useRouter();
  const segments = useSegments();
  const [initialized, setInitialized] = useState(false);

  // Inicializar scroll behavior solo en web
  useEffect(() => {
    const cleanup = setupScrollBehavior();
    return cleanup;
  }, []);

  useEffect(() => {
    Promise.all([restore(), fetchLanguages()]).then(() => {
      setInitialized(true);
    });
  }, []);

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
