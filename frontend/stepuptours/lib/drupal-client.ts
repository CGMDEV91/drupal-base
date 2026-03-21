// lib/drupal-client.ts
// ⚠️ ÚNICO FICHERO CON REFERENCIAS A DRUPAL
// Toda la lógica de comunicación con Drupal JSON:API vive aquí.
// El resto de la app no sabe que el backend es Drupal.

import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { Jsona } from 'jsona';
import { sessionStorage } from './session';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';
const JSON_API_PREFIX = '/jsonapi';
const deserializer = new Jsona();

// ── Langcode para peticiones traducidas ────────────────────────────────────
let currentLangcode = 'en';

export function setApiLanguage(langcode: string): void {
  currentLangcode = langcode;
}

export function getApiLanguage(): string {
  return currentLangcode;
}

function buildBaseURL(langcode: string): string {
  if (langcode && langcode !== 'en') {
    return `${BASE_URL}/${langcode}${JSON_API_PREFIX}`;
  }
  return `${BASE_URL}${JSON_API_PREFIX}`;
}

// ── Instancia Axios ───────────────────────────────────────────────────────────

const drupalClient: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}${JSON_API_PREFIX}`,
  headers: {
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/vnd.api+json',
  },
  timeout: 15000,
});

// ── Interceptor de request ────────────────────────────────────────────────────

drupalClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    config.baseURL = buildBaseURL(currentLangcode);

    const session = await sessionStorage.getSession();
    if (session?.token) {
      const prefix = session.tokenType === 'bearer' ? 'Bearer' : 'Basic';
      config.headers.Authorization = `${prefix} ${session.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Interceptor de response ───────────────────────────────────────────────────

drupalClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await sessionStorage.clearSession();
    }
    return Promise.reject(normalizeError(error));
  }
);

// ── Error normalizer ─────────────────────────────────────────────────────────

function normalizeError(error: any): Error {
  const drupalErrors = error.response?.data?.errors;
  if (drupalErrors?.length) {
    return new Error(drupalErrors[0].detail ?? drupalErrors[0].title ?? 'Unknown error');
  }
  return new Error(error.message ?? 'Network error');
}

// ── Helpers de construcción de queries ───────────────────────────────────────

export function buildInclude(relations: string[]): string {
  return relations.length ? `include=${relations.join(',')}` : '';
}

export function buildFields(fields: Record<string, string[]>): string {
  return Object.entries(fields)
    .map(([type, fieldList]) => `fields[${type}]=${fieldList.join(',')}`)
    .join('&');
}

export function buildFilters(filters: Record<string, any>): string {
  return Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([key, value]) => `filter[${key}]=${encodeURIComponent(value)}`)
    .join('&');
}

export function buildPage(page: number, limit: number): string {
  return `page[limit]=${limit}&page[offset]=${(page - 1) * limit}`;
}

// ── Helpers de imagen ─────────────────────────────────────────────────────────

function resolveImageUrl(raw: any): string | null {
  const url = raw?.uri?.url ?? raw?.url ?? null;
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${BASE_URL}${url}`;
}

// ── Métodos HTTP ──────────────────────────────────────────────────────────────

export async function drupalGet<T>(
  endpoint: string,
  params?: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const url = params ? `${endpoint}?${params}` : endpoint;
  const response = await drupalClient.get(url, config);
  return deserializer.deserialize(response.data) as T;
}

export async function drupalGetRaw(
  endpoint: string,
  params?: string,
  config?: AxiosRequestConfig
) {
  const url = params ? `${endpoint}?${params}` : endpoint;
  const response = await drupalClient.get(url, config);
  return {
    data: deserializer.deserialize(response.data),
    meta: response.data.meta ?? {},
    links: response.data.links ?? {},
  };
}

export async function drupalPost<T>(endpoint: string, body: object): Promise<T> {
  const response = await drupalClient.post(endpoint, body);
  return deserializer.deserialize(response.data) as T;
}

export async function drupalPatch<T>(endpoint: string, body: object): Promise<T> {
  const response = await drupalClient.patch(endpoint, body);
  return deserializer.deserialize(response.data) as T;
}

export async function drupalDelete(endpoint: string): Promise<void> {
  await drupalClient.delete(endpoint);
}

// ── Helpers de mapeo: Drupal → tipos del dominio ──────────────────────────────

export function mapDrupalUser(raw: any): import('../types').User {
  // ── Roles ─────────────────────────────────────────────────────────────────
  // Jsona deserializa las relaciones y renombra meta → resourceIdObjMeta
  // El machine name del rol está en resourceIdObjMeta.drupal_internal__target_id
  const roles: string[] = Array.isArray(raw.roles)
    ? raw.roles.map((r: any) => {
      if (typeof r === 'string') return r;
      // Jsona resuelto: resourceIdObjMeta tiene el machine name
      const fromResourceMeta = r.resourceIdObjMeta?.drupal_internal__target_id;
      if (fromResourceMeta) return fromResourceMeta;
      // Fallback: meta estándar JSON:API
      const fromMeta = r.meta?.drupal_internal__target_id ?? r.meta?.drupal_internal__id;
      if (fromMeta) return fromMeta;
      // Último recurso: id (UUID)
      return r.id ?? r;
    })
    : (raw.relationships?.roles?.data ?? []).map(
      (r: any) =>
        r.meta?.drupal_internal__target_id ??
        r.meta?.drupal_internal__id ??
        r.id
    );

  // ── Country ───────────────────────────────────────────────────────────────
  // Cuando viene de PATCH sin include, field_country solo tiene id y type
  // Cuando viene de GET con include=field_country, tiene también name
  const country = raw.field_country
    ? {
      id: raw.field_country.id,
      name: raw.field_country.name ?? raw.field_country.attributes?.name ?? null,
    }
    : null;

  return {
    id: raw.id,
    username: raw.name ?? '',
    email: raw.mail ?? '',
    publicName: raw.field_public_name ?? raw.name ?? '',
    // preferred_langcode es el campo correcto en Drupal — langcode es el idioma del nodo
    preferredLanguage: raw.preferred_langcode ?? raw.langcode ?? 'en',
    country,
    avatar: resolveImageUrl(raw.user_picture),
    experiencePoints: raw.field_experience_points ?? 0,
    roles,
    createdAt: raw.created ?? '',
  };
}

export function mapDrupalTour(raw: any): import('../types').Tour {
  return {
    id: raw.id,
    drupalInternalId: raw.drupal_internal__nid ?? 0,
    title: raw.title ?? '',
    description: raw.field_description?.value ?? raw.field_description ?? '',
    image: resolveImageUrl(raw.field_image),
    duration: raw.field_duration ?? 0,
    averageRate: parseFloat(raw.field_average_rate ?? '0'),
    ratingCount: raw.field_rating_count ?? 0,
    stopsCount: raw.field_steps_count ?? 0,
    donationCount: raw.field_donation_count ?? 0,
    donationTotal: parseFloat(raw.field_donation_total ?? '0'),
    city: raw.field_city ? { id: raw.field_city.id, name: raw.field_city.name } : null,
    country: raw.field_country ? { id: raw.field_country.id, name: raw.field_country.name } : null,
    location: raw.field_location
      ? { lat: raw.field_location.lat, lon: raw.field_location.lon }
      : null,
    featuredBusinesses: [
      raw.field_featured_business_1 ? mapDrupalBusiness(raw.field_featured_business_1) : null,
      raw.field_featured_business_2 ? mapDrupalBusiness(raw.field_featured_business_2) : null,
      raw.field_featured_business_3 ? mapDrupalBusiness(raw.field_featured_business_3) : null,
    ],
    authorId: raw.uid?.id ?? raw.uid ?? '',
    published: raw.status ?? false,
  };
}

export function mapDrupalTourStep(raw: any): import('../types').TourStep {
  return {
    id: raw.id,
    title: raw.title ?? '',
    description: raw.field_description?.value ?? raw.field_description ?? '',
    order: raw.field_order ?? 0,
    location: raw.field_location
      ? { lat: raw.field_location.lat, lon: raw.field_location.lon }
      : null,
    totalCompleted: raw.field_total_completed ?? 0,
    featuredBusiness: raw.field_featured_business
      ? mapDrupalBusiness(raw.field_featured_business)
      : null,
  };
}

export function mapDrupalBusiness(raw: any): import('../types').Business {
  return {
    id: raw.id,
    name: raw.title ?? '',
    description: raw.field_description?.value ?? '',
    logo: resolveImageUrl(raw.field_logo),
    website: raw.field_website?.uri ?? null,
    phone: raw.field_phone ?? null,
    location: raw.field_location
      ? { lat: raw.field_location.lat, lon: raw.field_location.lon }
      : null,
    category: raw.field_category
      ? { id: raw.field_category.id, name: raw.field_category.name }
      : null,
  };
}

export function mapDrupalActivity(raw: any): import('../types').TourActivity {
  return {
    id: raw.id,
    tourId: raw.field_tour?.id ?? '',
    userId: raw.field_user?.id ?? '',
    isFavorite: raw.field_is_favorite ?? false,
    isSaved: raw.field_is_saved ?? false,
    isCompleted: raw.field_is_completed ?? false,
    userRating: raw.field_user_rating ? parseFloat(raw.field_user_rating) : null,
    stepsCompleted: (raw.field_steps_completed ?? []).map((s: any) => s.id ?? s),
    completedAt: raw.field_completed_at ?? null,
    ratedAt: raw.field_rated_at ?? null,
    xpAwarded: raw.field_xp_awarded ?? false,
  };
}

export function extractTourFromActivity(raw: any): import('../types').Tour | null {
  const tourRaw = raw.field_tour;
  if (!tourRaw || typeof tourRaw !== 'object' || !tourRaw.id) return null;
  if (!tourRaw.title) return null;
  return mapDrupalTour(tourRaw);
}

export function mapDrupalSubscription(raw: any): import('../types').Subscription {
  const plan = raw.field_plan;
  return {
    id: raw.id,
    userId: raw.field_user?.id ?? '',
    plan: {
      id: plan?.id ?? '',
      title: plan?.title ?? '',
      planType: plan?.field_plan_type ?? 'free',
      billingCycle: plan?.field_billing_cycle ?? 'none',
      price: parseFloat(plan?.field_price ?? '0'),
      maxFeaturedDetail: plan?.field_max_featured_detail ?? 1,
      maxFeaturedSteps: plan?.field_max_featured_steps ?? 3,
      maxLanguages: plan?.field_max_languages ?? 5,
      featuredPerStep: plan?.field_featured_per_step ?? false,
      autoRenewal: plan?.field_auto_renewal ?? false,
      active: plan?.status ?? true,
    },
    status: raw.field_subscription_status ?? 'active',
    startDate: raw.field_start_date ?? '',
    endDate: raw.field_end_date ?? '',
    autoRenewal: raw.field_auto_renewal ?? false,
    lastPaymentAt: raw.field_last_payment_at ?? null,
  };
}

export function mapDrupalSubscriptionPlan(raw: any): import('../types').SubscriptionPlan {
  return {
    id: raw.id,
    title: raw.title ?? '',
    planType: raw.field_plan_type ?? 'premium',
    billingCycle: raw.field_billing_cycle ?? 'monthly',
    price: parseFloat(raw.field_price ?? '0'),
    maxFeaturedDetail: raw.field_max_featured_detail ?? 1,
    maxFeaturedSteps: raw.field_max_featured_steps ?? 3,
    maxLanguages: raw.field_max_languages ?? 5,
    featuredPerStep: raw.field_featured_per_step ?? false,
    autoRenewal: raw.field_auto_renewal_available ?? true,
    active: raw.status ?? true,
  };
}

export function mapDrupalDonation(raw: any): import('../types').Donation {
  return {
    id: raw.id,
    tourId: raw.field_tour?.id ?? '',
    tourTitle: raw.field_tour?.title ?? '',
    userId: raw.field_user?.id ?? '',
    donorName: raw.field_user?.field_public_name ?? raw.field_user?.name ?? 'Anónimo',
    amount: parseFloat(raw.field_amount ?? '0'),
    currency: raw.field_currency?.name ?? 'EUR',
    guideRevenue: parseFloat(raw.field_guide_revenue ?? '0'),
    platformRevenue: parseFloat(raw.field_platform_revenue ?? '0'),
    createdAt: raw.created ?? '',
  };
}

export function mapDrupalProfessionalProfile(raw: any): import('../types').ProfessionalProfile {
  const addr = raw.field_address ?? null;
  return {
    id: raw.id,
    userId: raw.field_user?.id ?? '',
    fullName: raw.field_full_name ?? '',
    taxId: raw.field_tax_id ?? '',
    address: addr
      ? {
          addressLine1: addr.address_line1 ?? '',
          addressLine2: addr.address_line2 ?? '',
          locality: addr.locality ?? '',
          postalCode: addr.postal_code ?? '',
          countryCode: addr.country_code ?? '',
          administrativeArea: addr.administrative_area ?? '',
        }
      : null,
    accountHolder: raw.field_account_holder ?? '',
    iban: raw.field_bank_iban ?? '',
    bic: raw.field_bank_bic ?? '',
    revenuePercentage: parseFloat(raw.field_revenue_percentage ?? '75'),
  };
}

export { drupalClient };
