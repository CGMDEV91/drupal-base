import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';

function getAuthHeader(): Record<string, string> {
  const session = useAuthStore.getState().session;
  if (!session?.token) return {};
  return { Authorization: `Basic ${session.token}` };
}

export interface SocialLink {
  url: string;
  visible: boolean;
}

export interface StripeSettings {
  publishableKey: string;
  secretKeyConfigured: boolean;
  webhookConfigured: boolean;
}

export interface SiteSettings {
  siteName: string;
  siteEmail: string;
  slogan: string;
  address: string;
  phone: string;
  socialLinks: {
    facebook: SocialLink;
    twitter: SocialLink;
    instagram: SocialLink;
  };
  stripeSettings?: StripeSettings;
  paymentSettings?: {
    platformRevenuePercentage: number;
    stripeConfigured: boolean;
  };
}

export interface StripeKeysInput {
  publishableKey?: string;
  secretKey?: string;
  webhookSecret?: string;
}

export interface TranslationRow {
  key: string;
  source: string;
  target: string;
}

export interface AdminLanguage {
  id: string;
  label: string;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const { data } = await axios.get(`${BASE_URL}/api/site-settings`);
  return data;
}

export async function updateSiteSettings(settings: Partial<SiteSettings>): Promise<SiteSettings> {
  const { data } = await axios.put(`${BASE_URL}/api/site-settings`, settings, {
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
  });
  return data;
}

export async function getAdminLanguages(): Promise<AdminLanguage[]> {
  const { data } = await axios.get(`${BASE_URL}/api/admin/languages`);
  return data;
}

export async function getTranslations(langcode: string): Promise<TranslationRow[]> {
  const { data } = await axios.get(`${BASE_URL}/api/admin/translations/${langcode}`, {
    headers: getAuthHeader(),
  });
  return data;
}

export async function updateStripeKeys(keys: StripeKeysInput): Promise<SiteSettings> {
  const { data } = await axios.put(
    `${BASE_URL}/api/site-settings`,
    { stripeSettings: keys },
    { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } },
  );
  return data;
}

export async function saveTranslations(
  langcode: string,
  translations: { key: string; value: string }[],
): Promise<void> {
  await axios.put(
    `${BASE_URL}/api/admin/translations/${langcode}`,
    { translations },
    { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } },
  );
}
