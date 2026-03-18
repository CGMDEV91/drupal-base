// stores/auth.store.ts
// Estado global de autenticación

import { create } from 'zustand';
import { login, logout, restoreSession, register } from '../services/auth.service';
import { inactivityTracker } from '../lib/session';
import type { AuthCredentials, AuthSession, User } from '../types';

interface AuthState {
  session: AuthSession | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  signIn: (credentials: AuthCredentials) => Promise<void>;
  signUp: (data: { username: string; email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  restore: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: false,
  error: null,

  signIn: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const session = await login(credentials);
      set({ session, user: session.user, isLoading: false });

      // Arrancar tracker de inactividad
      inactivityTracker.start(() => {
        get().signOut();
      });
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Error al iniciar sesión' });
    }
  },

  signUp: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const session = await register(data);
      set({ session, user: session.user, isLoading: false });
      inactivityTracker.start(() => {
        get().signOut();
      });
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Error al registrarse' });
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    await logout();
    set({ session: null, user: null, isLoading: false, error: null });
  },

  restore: async () => {
    set({ isLoading: true });
    try {
      const session = await restoreSession();
      if (session) {
        set({ session, user: session.user });
        inactivityTracker.start(() => {
          get().signOut();
        });
      }
    } catch {
      // Sesión inválida o expirada — no hacer nada
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
