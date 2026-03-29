// lib/session.ts
// Gestión de sesión, almacenamiento seguro, cookies e inactividad
// Agnóstico del backend

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AuthSession } from '../types';

const SESSION_KEY = 'app_session';
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos

// ── Abstracción de almacenamiento ─────────────────────────────────────────────
// En web usa sessionStorage (se borra al cerrar el navegador/pestaña),
// en nativo usa SecureStore.

const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return window.sessionStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },

  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      window.sessionStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      window.sessionStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

// ── Session Storage ───────────────────────────────────────────────────────────

export const sessionStorage = {
  async getSession(): Promise<AuthSession | null> {
    try {
      const raw = await storage.get(SESSION_KEY);
      if (!raw) return null;
      const session: AuthSession = JSON.parse(raw);

      // Verificar expiración si existe
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        await this.clearSession();
        return null;
      }

      return session;
    } catch {
      return null;
    }
  },

  async saveSession(session: AuthSession): Promise<void> {
    await storage.set(SESSION_KEY, JSON.stringify(session));
  },

  async clearSession(): Promise<void> {
    await storage.remove(SESSION_KEY);
    inactivityTracker.reset();
  },

  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return session !== null;
  },

  async getToken(): Promise<string | null> {
    const session = await this.getSession();
    return session?.token ?? null;
  },

  async getUser(): Promise<AuthSession['user'] | null> {
    const session = await this.getSession();
    return session?.user ?? null;
  },
};

// ── Inactivity Tracker ────────────────────────────────────────────────────────

type InactivityCallback = () => void;

export const inactivityTracker = (() => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let onExpire: InactivityCallback | null = null;

  const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

  const reset = () => {
    if (timer) clearTimeout(timer);
    if (!onExpire) return;
    timer = setTimeout(() => {
      sessionStorage.clearSession();
      onExpire?.();
    }, INACTIVITY_TIMEOUT_MS);
  };

  const handleActivity = () => reset();

  const start = (callback: InactivityCallback) => {
    onExpire = callback;
    reset();
    if (Platform.OS === 'web') {
      ACTIVITY_EVENTS.forEach((e) =>
        window.addEventListener(e, handleActivity, { passive: true }),
      );
    }
  };

  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    onExpire = null;
    if (Platform.OS === 'web') {
      ACTIVITY_EVENTS.forEach((e) =>
        window.removeEventListener(e, handleActivity),
      );
    }
  };

  return { start, stop, reset };
})();

// ── Cookie helpers (web only) ─────────────────────────────────────────────────

export const cookieStorage = {
  set(name: string, value: string, days = 7): void {
    if (Platform.OS !== 'web') return;
    const expires = new Date();
    expires.setDate(expires.getDate() + days);
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
  },

  get(name: string): string | null {
    if (Platform.OS !== 'web') return null;
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match ? decodeURIComponent(match[2]) : null;
  },

  remove(name: string): void {
    if (Platform.OS !== 'web') return;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  },
};

// ── Preferencias del usuario (no sensibles) ───────────────────────────────────

const PREFS_KEY = 'app_preferences';

export interface UserPreferences {
  language: string;
  theme: 'light' | 'dark' | 'system';
  currency: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'es',
  theme: 'system',
  currency: 'EUR',
};

export const preferencesStorage = {
  get(): UserPreferences {
    if (Platform.OS !== 'web') return DEFAULT_PREFERENCES;
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  },

  set(prefs: Partial<UserPreferences>): void {
    if (Platform.OS !== 'web') return;
    const current = this.get();
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
  },

  clear(): void {
    if (Platform.OS !== 'web') return;
    localStorage.removeItem(PREFS_KEY);
  },
};
