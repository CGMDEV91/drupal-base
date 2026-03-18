// stores/language.store.ts
// Estado global de idioma seleccionado

import { create } from 'zustand';
import { getAvailableLanguages, type Language } from '../services/language.service';
import { preferencesStorage } from '../lib/session';
import { setApiLanguage } from '../lib/drupal-client';
import i18n from '../i18n';

interface LanguageState {
  languages: Language[];
  currentLanguage: Language | null;
  isLoading: boolean;

  fetchLanguages: () => Promise<void>;
  setLanguage: (language: Language) => void;
  setLanguageByCode: (langcode: string) => void;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  languages: [],
  currentLanguage: null,
  isLoading: false,

  fetchLanguages: async () => {
    set({ isLoading: true });
    try {
      const languages = await getAvailableLanguages();
      const prefs = preferencesStorage.get();

      // Restaurar idioma guardado en preferencias
      const saved = languages.find((l) => l.id === prefs.language);
      const defaultLang = saved ?? languages.find((l) => l.isDefault) ?? languages[0];

      if (defaultLang) {
        setApiLanguage(defaultLang.id);
        i18n.changeLanguage(defaultLang.id);
      }

      set({ languages, currentLanguage: defaultLang, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setLanguage: (language) => {
    preferencesStorage.set({ language: language.id });
    setApiLanguage(language.id);
    i18n.changeLanguage(language.id);
    set({ currentLanguage: language });
  },

  setLanguageByCode: (langcode) => {
    const { languages } = get();
    const lang = languages.find((l) => l.id === langcode);
    if (lang) {
      get().setLanguage(lang);
    } else {
      // Si no hay match exacto, solo sincronizar API e i18n
      setApiLanguage(langcode);
      i18n.changeLanguage(langcode);
    }
  },
}));
