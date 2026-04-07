// lib/drupal-client.ts
// ⚠️ ÚNICO FICHERO CON REFERENCIAS A DRUPAL
// Toda la lógica de comunicación con Drupal JSON:API vive aquí.
// El resto de la app no sabe que el backend es Drupal.

import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { Jsona } from 'jsona';
import { sessionStorage as appSession } from './session';
import type {
  User,
  Tour,
  TourStep,
  Business,
  TourActivity,
  Subscription,
  SubscriptionPlan,
  SubscriptionPayment,
  Donation,
  ProfessionalProfile,
} from '../types';

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

// Skip ngrok browser interstitial for ALL axios requests when behind a ngrok tunnel.
// This interceptor is registered on the global axios instance so it covers
// every direct axios.get/post call in the services too, not just drupalClient.
if (BASE_URL.includes('ngrok')) {
  axios.interceptors.request.use((config) => {
    config.headers = config.headers ?? {};
    config.headers['ngrok-skip-browser-warning'] = '1';
    return config;
  });
}

const ngrokHeaders = BASE_URL.includes('ngrok') ? { 'ngrok-skip-browser-warning': '1' } : {};

/**
 * Headers to attach to expo-image `source.headers` when behind a ngrok tunnel.
 * Forces expo-image to use fetch() instead of <img>, which skips ngrok's HTML
 * interstitial page and allows the CORS nginx config to serve the file correctly.
 * Empty on production (non-ngrok) — no overhead.
 */
export const imageHeaders: Record<string, string> = ngrokHeaders;

const drupalClient: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}${JSON_API_PREFIX}`,
  headers: {
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/vnd.api+json',
    ...ngrokHeaders,
  },
  timeout: 15000,
});

// Second client: always uses the base (English) URL — used for PATCH/DELETE so
// the node's original-language version is edited instead of creating/updating a
// translation.  The language prefix is intentionally omitted here.
const drupalClientBase: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}${JSON_API_PREFIX}`,
  headers: {
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/vnd.api+json',
    ...ngrokHeaders,
  },
  timeout: 15000,
});

// ── Auth interceptor shared helper ───────────────────────────────────────────

async function applyAuth(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
  const session = await appSession.getSession();
  if (session?.token) {
    const prefix = session.tokenType === 'bearer' ? 'Bearer' : 'Basic';
    config.headers.Authorization = `${prefix} ${session.token}`;
  }
  return config;
}

// ── Interceptor de request (lang-aware) ──────────────────────────────────────

drupalClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    config.baseURL = buildBaseURL(currentLangcode);
    return applyAuth(config);
  },
  (error) => Promise.reject(error)
);

// ── Interceptor de request (base, no lang prefix) ────────────────────────────

drupalClientBase.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => applyAuth(config),
  (error) => Promise.reject(error)
);

// ── Interceptor de response ───────────────────────────────────────────────────

const responseErrorHandler = async (error: any) => {
  if (error.response?.status === 401) {
    await appSession.clearSession();
  }
  return Promise.reject(normalizeError(error));
};

drupalClient.interceptors.response.use((r) => r, responseErrorHandler);
drupalClientBase.interceptors.response.use((r) => r, responseErrorHandler);

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
  if (url.startsWith('http')) {
    // Always rewrite image URLs to use the current API host so they work
    // regardless of whether Drupal returns ddev.site, localhost:PORT or any
    // other internal host (e.g. when accessed via ngrok or a tunnel).
    try {
      const base = new URL(BASE_URL);
      const parsed = new URL(url);
      if (parsed.host !== base.host) {
        parsed.protocol = base.protocol;
        parsed.host = base.host;
        return parsed.toString();
      }
    } catch { /* ignore malformed URLs */ }
    return url;
  }
  return `${BASE_URL}${url}`;
}

// ── Geofield helper ───────────────────────────────────────────────────────────
// Drupal geofield requires WKT format for JSON:API writes.
// WKT notation: POINT (longitude latitude) — longitude comes first.

export function buildGeoFieldValue(lat: number, lon: number): object {
  return {
    value: `POINT (${lon} ${lat})`,
    geo_type: 'Point',
    lat,
    lon,
  };
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

/**
 * Fetches the raw JSON:API response without Jsona deserialization.
 * Use when Jsona fails to resolve relationships (e.g. entity refs without includes).
 */
export async function drupalGetJsonApi(
  endpoint: string,
  params?: string,
): Promise<any[]> {
  const url = params ? `${endpoint}?${params}` : endpoint;
  const response = await drupalClient.get(url);
  return response.data?.data ?? [];
}

export async function drupalPost<T>(endpoint: string, body: object): Promise<T> {
  const response = await drupalClient.post(endpoint, body);
  return deserializer.deserialize(response.data) as T;
}

export async function drupalPatch<T>(endpoint: string, body: object): Promise<T> {
  const response = await drupalClient.patch(endpoint, body);
  return deserializer.deserialize(response.data) as T;
}

/**
 * PATCH targeting the entity's original-language URL.
 * When `langcode` is provided and is not 'en' (the site default), the request
 * is sent with the appropriate language prefix so Drupal edits the correct
 * translation instead of silently no-oping against a non-existent English
 * translation.
 */
export async function drupalPatchBase<T>(endpoint: string, body: object, langcode?: string): Promise<T> {
  const config: any = {};
  if (langcode && langcode !== 'en') {
    config.baseURL = `${BASE_URL}/${langcode}${JSON_API_PREFIX}`;
  }
  const response = await drupalClientBase.patch(endpoint, body, config);
  return deserializer.deserialize(response.data) as T;
}

export async function drupalDelete(endpoint: string): Promise<void> {
  await drupalClient.delete(endpoint);
}

// ── File upload ───────────────────────────────────────────────────────────────

/**
 * Upload a file to Drupal via the JSON:API file upload endpoint.
 * Returns the file UUID to use as a relationship in node create/update.
 *
 * @param bundle   e.g. 'business' or 'tour'
 * @param field    e.g. 'field_logo' or 'field_image'
 * @param uri      Local file URI from expo-image-picker or a web File input
 * @param filename Original filename with extension (e.g. 'photo.jpg')
 */
export async function uploadDrupalFile(
  bundle: string,
  field: string,
  uri: string,
  filename: string
): Promise<string> {
  // Fetch the file as a Blob — works on both web and native
  const fileResponse = await fetch(uri);
  if (!fileResponse.ok) {
    throw new Error(`Failed to read file: ${fileResponse.status}`);
  }
  const blob = await fileResponse.blob();

  // Build auth header from the current session
  const session = await appSession.getSession();
  const authHeader = session?.token
    ? `${session.tokenType === 'bearer' ? 'Bearer' : 'Basic'} ${session.token}`
    : undefined;

  const uploadUrl = `${BASE_URL}/jsonapi/node/${bundle}/${field}`;

  const response = await drupalClient.post(uploadUrl, blob, {
    baseURL: '',          // use absolute URL — bypass the drupalClient baseURL
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `file; filename="${filename}"`,
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    responseType: 'json',
    transformRequest: [(data) => data], // send Blob as-is, skip JSON serialization
  });

  const fileId: string | undefined = response.data?.data?.id;
  if (!fileId) {
    throw new Error('File upload succeeded but no file UUID was returned');
  }
  return fileId;
}

// ── Helpers de mapeo: Drupal → tipos del dominio ──────────────────────────────

export function mapDrupalUser(raw: any): User {
  const roles: string[] = Array.isArray(raw.roles)
    ? raw.roles.map((r: any) => {
      if (typeof r === 'string') return r;
      const fromResourceMeta = r.resourceIdObjMeta?.drupal_internal__target_id;
      if (fromResourceMeta) return fromResourceMeta;
      const fromMeta = r.meta?.drupal_internal__target_id ?? r.meta?.drupal_internal__id;
      if (fromMeta) return fromMeta;
      return r.id ?? r;
    })
    : (raw.relationships?.roles?.data ?? []).map(
      (r: any) =>
        r.meta?.drupal_internal__target_id ??
        r.meta?.drupal_internal__id ??
        r.id
    );

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
    preferredLanguage: raw.preferred_langcode ?? raw.langcode ?? 'en',
    country,
    avatar: resolveImageUrl(raw.user_picture),
    experiencePoints: raw.field_experience_points ?? 0,
    roles,
    createdAt: raw.created ?? '',
  };
}

export function mapDrupalTour(raw: any): Tour {
  return {
    id: raw.id,
    drupalInternalId: raw.drupal_internal__nid ?? 0,
    title: raw.title ?? '',
    description: raw.field_description?.value ?? raw.field_description ?? '',
    image: resolveImageUrl(raw.field_image),
    duration: raw.field_duration ?? 0,
    averageRate: parseFloat(raw.field_average_rate ?? '0'),
    ratingCount: parseInt(raw.field_rating_count ?? '0', 10),
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
    langcode: raw.langcode ?? 'en',
  };
}

export function mapDrupalTourStep(raw: any): TourStep {
  return {
    id: raw.id,
    title: raw.title ?? '',
    description: raw.field_description?.value ?? raw.field_description ?? '',
    contentLangcode: raw.langcode ?? 'en',
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

export function mapDrupalBusiness(raw: any): Business {
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
    langcode: raw.langcode ?? 'en',
  };
}

export function mapDrupalActivity(raw: any): TourActivity {
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

export function extractTourFromActivity(raw: any): Tour | null {
  const tourRaw = raw.field_tour;
  if (!tourRaw || typeof tourRaw !== 'object' || !tourRaw.id) return null;
  if (!tourRaw.title) return null;
  return mapDrupalTour(tourRaw);
}

export function mapDrupalSubscription(raw: any): Subscription {
  const plan = raw.field_plan;
  return {
    id: raw.id,
    userId: raw.field_user?.id ?? '',
    plan: {
      id: plan?.id ?? '',
      title: plan?.title ?? '',
      planType: plan?.field_plan_type ?? 'free',
      billingCycle: normalizeBillingCycle(plan?.field_billing_cycle),
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
    stripeSubscriptionId: raw.field_stripe_subscription_id ?? null,
    stripeCustomerId: raw.field_stripe_customer_id ?? null,
  };
}

export function mapDrupalSubscriptionPayment(raw: any): SubscriptionPayment {
  return {
    id: raw.id,
    subscriptionId: raw.field_subscription?.id ?? '',
    userId: raw.field_user?.id ?? '',
    planTitle: raw.field_plan?.title ?? '',
    amount: parseFloat(raw.field_amount ?? '0'),
    stripeInvoiceId: raw.field_stripe_invoice_id ?? '',
    stripePaymentIntent: raw.field_stripe_payment_intent ?? '',
    status: raw.field_payment_status ?? 'succeed',
    periodStart: raw.field_period_start ?? '',
    periodEnd: raw.field_period_end ?? '',
  };
}

function normalizeBillingCycle(raw: string | undefined | null): string {
  if (!raw) return 'monthly';
  // Drupal stores the annual cycle as 'anually' (typo) — normalise to 'annual'.
  if (raw === 'anually') return 'annual';
  return raw;
}

export function mapDrupalSubscriptionPlan(raw: any): SubscriptionPlan {
  return {
    id: raw.id,
    title: raw.title ?? '',
    planType: raw.field_plan_type ?? 'premium',
    billingCycle: normalizeBillingCycle(raw.field_billing_cycle),
    price: parseFloat(raw.field_price ?? '0'),
    maxFeaturedDetail: raw.field_max_featured_detail ?? 1,
    maxFeaturedSteps: raw.field_max_featured_steps ?? 3,
    maxLanguages: raw.field_max_languages ?? 5,
    featuredPerStep: raw.field_featured_per_step ?? false,
    autoRenewal: raw.field_auto_renewal_available ?? true,
    active: raw.status ?? true,
  };
}

export function mapDrupalDonation(raw: any): Donation {
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

// ── Business API ──────────────────────────────────────────────────────────────

const BUSINESS_INCLUDE = ['field_category', 'field_logo'];

const BUSINESS_FIELDS = {
  'node--business': [
    'title',
    'field_description',
    'field_logo',
    'field_website',
    'field_phone',
    'field_location',
    'field_category',
    'field_status',
    'uid',
    'langcode',
  ],
  'taxonomy_term--business_category': ['name'],
  'file--file': ['uri', 'url'],
};

function buildBusinessParams(extra?: string): string {
  const parts = [
    buildInclude(BUSINESS_INCLUDE),
    buildFields(BUSINESS_FIELDS),
  ];
  if (extra) parts.push(extra);
  return parts.filter(Boolean).join('&');
}

export async function fetchBusinesses(authorId?: string): Promise<Business[]> {
  const extra = authorId ? `filter[uid.id]=${authorId}&sort=-created` : 'sort=-created';
  const params = buildBusinessParams(extra);
  const raw = await drupalGet<any[]>('/node/business', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(mapDrupalBusiness);
}

export async function fetchBusinessById(id: string): Promise<Business> {
  const params = buildBusinessParams();
  const raw = await drupalGet<any>(`/node/business/${id}`, params);
  return mapDrupalBusiness(raw);
}

export async function searchBusinesses(query: string, authorId?: string): Promise<Business[]> {
  const filters = [
    `filter[title][operator]=CONTAINS&filter[title][value]=${encodeURIComponent(query)}`,
    authorId ? `filter[uid.id]=${authorId}` : '',
    'sort=title',
  ].filter(Boolean).join('&');
  const params = buildBusinessParams(filters);
  const raw = await drupalGet<any[]>('/node/business', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(mapDrupalBusiness);
}

export interface BusinessInput {
  name: string;
  description?: string;
  website?: string;
  phone?: string;
  categoryId?: string;
  lat?: number;
  lon?: number;
  /** UUID of an already-uploaded file entity to set as field_logo */
  logoId?: string;
  langcode?: string;
}

export async function createBusinessNode(data: BusinessInput): Promise<Business> {
  const attributes: Record<string, any> = {
    title: data.name,
  };
  if (data.description) {
    attributes.field_description = { value: data.description, format: 'basic_html' };
  }
  if (data.website) {
    attributes.field_website = { uri: data.website, title: '' };
  }
  if (data.phone) {
    attributes.field_phone = data.phone;
  }
  if (data.lat !== undefined && data.lon !== undefined && !isNaN(data.lat) && !isNaN(data.lon)) {
    attributes.field_location = buildGeoFieldValue(data.lat, data.lon);
  }

  const relationships: Record<string, any> = {};
  if (data.categoryId) {
    relationships.field_category = {
      data: { type: 'taxonomy_term--business_category', id: data.categoryId },
    };
  }
  if (data.logoId) {
    relationships.field_logo = {
      data: { type: 'file--file', id: data.logoId },
    };
  }

  // Set node language: use the explicitly-provided langcode if given, otherwise
  // fall back to the current UI language.
  attributes.langcode = data.langcode ?? currentLangcode;

  const raw = await drupalPost<any>('/node/business', {
    data: {
      type: 'node--business',
      attributes,
      relationships,
    },
  });
  return mapDrupalBusiness(raw);
}

export async function updateBusinessNode(id: string, data: Partial<BusinessInput>, langcode?: string): Promise<Business> {
  const attributes: Record<string, any> = {};
  if (data.name !== undefined) attributes.title = data.name;
  if (data.description !== undefined) {
    attributes.field_description = { value: data.description, format: 'basic_html' };
  }
  if (data.website !== undefined) {
    attributes.field_website = data.website ? { uri: data.website, title: '' } : null;
  }
  if (data.phone !== undefined) attributes.field_phone = data.phone;
  // Always include field_location when lat/lon keys are present in data, even if
  // both are undefined (means the user cleared the fields — send null to Drupal).
  if ('lat' in data || 'lon' in data) {
    const hasCoords =
      data.lat !== undefined &&
      data.lon !== undefined &&
      !isNaN(data.lat) &&
      !isNaN(data.lon);
    attributes.field_location = hasCoords ? buildGeoFieldValue(data.lat!, data.lon!) : null;
  }

  const relationships: Record<string, any> = {};
  if (data.categoryId !== undefined) {
    relationships.field_category = data.categoryId
      ? { data: { type: 'taxonomy_term--business_category', id: data.categoryId } }
      : { data: null };
  }
  if (data.logoId !== undefined) {
    relationships.field_logo = data.logoId
      ? { data: { type: 'file--file', id: data.logoId } }
      : { data: null };
  }

  // Always edit the original-language node — pass the entity's langcode so the
  // correct language-prefix URL is used (avoids silently targeting a
  // non-existent English translation when the entity was created in Spanish).
  const raw = await drupalPatchBase<any>(`/node/business/${id}`, {
    data: {
      type: 'node--business',
      id,
      attributes,
      relationships,
    },
  }, langcode);
  return mapDrupalBusiness(raw);
}

export async function deleteBusinessNode(id: string): Promise<void> {
  await drupalDelete(`/node/business/${id}`);
}

export async function fetchBusinessCategories(): Promise<{ id: string; name: string }[]> {
  const raw = await drupalGet<any[]>('/taxonomy_term/business_category', 'sort=name');
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((item: any) => ({ id: item.id, name: item.name ?? '' }));
}

export function mapDrupalProfessionalProfile(raw: any): ProfessionalProfile {
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
