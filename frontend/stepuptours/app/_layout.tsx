import "../global.css";
import "../i18n";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { PortalHost } from "@rn-primitives/portal";
import { useAuthStore } from "../stores/auth.store";
import { useLanguageStore } from "../stores/language.store";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";

// ── Scroll overlay (solo web) ─────────────────────────────────────────────
function setupScrollBehavior() {
  if (typeof document === "undefined") return;

  type Entry = {
    thumb: HTMLElement;
    timeout: ReturnType<typeof setTimeout> | null;
  };

  const trackedEls = new WeakMap<HTMLElement, Entry>();

  function getOrCreateThumb(el: HTMLElement): Entry {
    if (trackedEls.has(el)) return trackedEls.get(el)!;

    // Necesitamos position relative para que el thumb absolute se ancle aquí
    const computed = window.getComputedStyle(el).position;
    if (!computed || computed === "static") {
      el.style.position = "relative";
    }

    const thumb = document.createElement("div");
    thumb.style.cssText = `
      position: absolute;
      right: 2px;
      width: 4px;
      border-radius: 4px;
      background: rgba(100, 100, 100, 0.5);
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
      z-index: 9999;
    `;

    el.appendChild(thumb);

    const entry: Entry = { thumb, timeout: null };
    trackedEls.set(el, entry);
    return entry;
  }

  function updateThumb(el: HTMLElement, thumb: HTMLElement) {
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight) return;

    const thumbHeight = Math.max(30, (clientHeight / scrollHeight) * clientHeight);
    const maxScroll = scrollHeight - clientHeight;
    const maxThumbTop = clientHeight - thumbHeight;
    const thumbTop = (scrollTop / maxScroll) * maxThumbTop;

    thumb.style.height = `${thumbHeight}px`;
    // Sumamos scrollTop para compensar el desplazamiento del contenedor,
    // así el thumb parece fijo en pantalla sin salir del flujo del layout.
    thumb.style.top = `${thumbTop + scrollTop}px`;
  }

  function onScroll(e: Event) {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    if (el.scrollHeight <= el.clientHeight) return;

    const entry = getOrCreateThumb(el);
    const { thumb } = entry;

    updateThumb(el, thumb);
    thumb.style.opacity = "1";

    if (entry.timeout) clearTimeout(entry.timeout);
    entry.timeout = setTimeout(() => {
      thumb.style.opacity = "0";
      entry.timeout = null;
    }, 2000);
  }

  document.addEventListener("scroll", onScroll, { capture: true, passive: true });

  return () => {
    document.removeEventListener("scroll", onScroll, { capture: true });
  };
}

export default function RootLayout() {
  useFonts({ ...Ionicons.font });

  const restore = useAuthStore((s) => s.restore);
  const fetchLanguages = useLanguageStore((s) => s.fetchLanguages);
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


  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <PortalHost />
    </>
  );
}