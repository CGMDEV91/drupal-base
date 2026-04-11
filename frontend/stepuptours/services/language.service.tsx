import axios from 'axios';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';

export interface Language {
  id: string; // 'es', 'en', 'fr'
  name: string;
  direction: 'ltr' | 'rtl';
  isDefault: boolean;
}

// nombres nativos
const NATIVE_NAMES: Record<string, string> = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  pl: 'Polski',
  ru: 'Русский',
  zh: '中文',
  ja: '日本語',
  ar: 'العربية',
  ca: 'Català',
  eu: 'Euskara',
  el: 'Ελληνικά',
};

export function getLanguageNativeName(
  langCode: string,
  fallback: string
): string {
  return NATIVE_NAMES[langCode] ?? fallback;
}

// obtener idiomas desde Drupal
export async function getAvailableLanguages(): Promise<Language[]> {
  try {
    const response = await axios.get(
      `${BASE_URL}/jsonapi/configurable_language/configurable_language`,
      {
        headers: {
          Accept: 'application/vnd.api+json',
        },
      }
    );

    const languages = response.data?.data ?? [];

    return languages
      .map((lang: any) => {
        const code = lang.attributes?.drupal_internal__id ?? lang.attributes?.id ?? lang.attributes?.langcode;

        if (!code || ['und', 'zxx'].includes(code)) return null;

        return {
          id: code,
          name: getLanguageNativeName(
            code,
            lang.attributes?.label ?? code.toUpperCase()
          ),
          direction: lang.attributes?.direction ?? 'ltr',
          isDefault: lang.attributes?.default ?? false,
        } as Language;
      })
      .filter(Boolean) as Language[];
  } catch (error) {
    console.warn('Language API failed, using fallback');

    return [
      { id: 'es', name: 'Español', direction: 'ltr', isDefault: true },
      { id: 'en', name: 'English', direction: 'ltr', isDefault: false },
      { id: 'fr', name: 'Français', direction: 'ltr', isDefault: false },
      { id: 'it', name: 'Italiano', direction: 'ltr', isDefault: false },
      { id: 'de', name: 'Deutsch', direction: 'ltr', isDefault: false },
      { id: 'el', name: 'Ελληνικά', direction: 'ltr', isDefault: false },
    ];
  }
}

// idioma → país
export function langCodeToCountryCode(langCode: string): string {
  const map: Record<string, string> = {
    es: 'ES',
    en: 'GB',
    fr: 'FR',
    de: 'DE',
    it: 'IT',
    pt: 'PT',
    nl: 'NL',
    pl: 'PL',
    ru: 'RU',
    zh: 'CN',
    ja: 'JP',
    ar: 'SA',
    ca: 'ES',
    eu: 'ES',
    el: 'GR',
  };

  return map[langCode] ?? 'US';
}
