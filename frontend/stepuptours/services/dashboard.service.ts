// services/dashboard.service.ts
// Dashboard service — agnostic of Drupal internals
// All Drupal-specific mapping happens in drupal-client.ts

import {
  drupalGet,
  drupalPost,
  drupalPatch,
  drupalPatchBase,
  drupalDelete,
  buildInclude,
  buildFields,
  buildGeoFieldValue,
  mapDrupalTour,
  mapDrupalTourStep,
  mapDrupalDonation,
  mapDrupalProfessionalProfile,
  mapDrupalSubscription,
  mapDrupalSubscriptionPlan,
  mapDrupalSubscriptionPayment,
  getApiLanguage,
} from '../lib/drupal-client';
import type { Tour, TourStep, Donation, ProfessionalProfile, Subscription, SubscriptionPlan, SubscriptionPayment } from '../types';

// ── Tours ─────────────────────────────────────────────────────────────────────

export async function getToursByAuthor(userId: string): Promise<Tour[]> {
  const params = [
    `filter[uid.id]=${userId}`,
    buildInclude(['field_image', 'field_city', 'field_country']),
    'sort=-created',
  ].join('&');
  const raw = await drupalGet<any[]>('/node/tour', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(mapDrupalTour);
}

export async function getTourById(tourId: string): Promise<Tour> {
  const params = [
    buildInclude([
      'field_image',
      'field_city',
      'field_country',
      'field_featured_business_1',
      'field_featured_business_1.field_logo',
      'field_featured_business_1.field_category',
      'field_featured_business_2',
      'field_featured_business_2.field_logo',
      'field_featured_business_2.field_category',
      'field_featured_business_3',
      'field_featured_business_3.field_logo',
      'field_featured_business_3.field_category',
    ]),
    buildFields({
      'node--tour': [
        'title',
        'field_description',
        'field_image',
        'field_duration',
        'field_average_rate',
        'field_rating_count',
        'field_donation_count',
        'field_donation_total',
        'field_location',
        'field_city',
        'field_country',
        'field_featured_business_1',
        'field_featured_business_2',
        'field_featured_business_3',
        'status',
        'uid',
        'langcode',
      ],
      'taxonomy_term--cities': ['name'],
      'taxonomy_term--countries': ['name'],
      'taxonomy_term--business_category': ['name'],
      'node--business': ['title', 'field_description', 'field_logo', 'field_website', 'field_phone', 'field_location', 'field_category', 'langcode'],
      'file--file': ['uri', 'url'],
    }),
  ].join('&');
  const raw = await drupalGet<any>(`/node/tour/${tourId}`, params);
  return mapDrupalTour(raw);
}

export async function getTourStepsForEdit(tourId: string): Promise<TourStep[]> {
  const params = [
    `filter[field_tour.id]=${tourId}`,
    'sort=field_order',
    buildFields({
      'node--tour_step': [
        'title',
        'field_description',
        'field_order',
        'field_location',
        'field_total_completed',
        'field_featured_business',
        'field_duration',
      ],
      'node--business': ['title', 'field_description', 'field_logo', 'field_website', 'field_phone', 'field_location', 'field_category'],
      'taxonomy_term--business_category': ['name'],
      'file--file': ['uri', 'url'],
    }),
    buildInclude(['field_featured_business', 'field_featured_business.field_logo', 'field_featured_business.field_category']),
  ].join('&');
  const raw = await drupalGet<any[]>('/node/tour_step', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(mapDrupalTourStep);
}

export async function deleteTour(tourId: string): Promise<void> {
  await drupalDelete(`/node/tour/${tourId}`);
}

export async function createTour(data: {
  title: string;
  description: string;
  duration: number;
  cityId?: string;
  countryId?: string;
  featuredBusinessIds?: (string | null)[];
  /** UUID of an already-uploaded file entity to set as field_image */
  imageId?: string;
  /** Language code for the new node; defaults to the current UI language. */
  langcode?: string;
}): Promise<Tour> {
  const relationships: Record<string, any> = {};
  if (data.cityId) {
    relationships.field_city = { data: { type: 'taxonomy_term--cities', id: data.cityId } };
  }
  if (data.countryId) {
    relationships.field_country = { data: { type: 'taxonomy_term--countries', id: data.countryId } };
  }
  if (data.imageId) {
    relationships.field_image = { data: { type: 'file--file', id: data.imageId } };
  }

  const slots = data.featuredBusinessIds ?? [null, null, null];
  relationships.field_featured_business_1 = {
    data: slots[0] ? { type: 'node--business', id: slots[0] } : null,
  };
  relationships.field_featured_business_2 = {
    data: slots[1] ? { type: 'node--business', id: slots[1] } : null,
  };
  relationships.field_featured_business_3 = {
    data: slots[2] ? { type: 'node--business', id: slots[2] } : null,
  };

  const raw = await drupalPost<any>('/node/tour', {
    data: {
      type: 'node--tour',
      attributes: {
        title: data.title,
        field_description: { value: data.description, format: 'basic_html' },
        field_duration: data.duration,
        // Set node language: use the explicitly-provided langcode if given,
        // otherwise fall back to the current UI language.
        langcode: data.langcode ?? getApiLanguage(),
      },
      relationships,
    },
  });
  return mapDrupalTour(raw);
}

export async function updateTour(
  tourId: string,
  data: {
    title: string;
    description: string;
    duration: number;
    cityId?: string;
    countryId?: string;
    featuredBusinessIds?: (string | null)[];
    /** UUID of an already-uploaded file entity to set as field_image.
     *  Pass null explicitly to clear the existing image. */
    imageId?: string | null;
  },
  langcode?: string
): Promise<Tour> {
  const relationships: Record<string, any> = {};
  if (data.cityId !== undefined) {
    relationships.field_city = data.cityId
      ? { data: { type: 'taxonomy_term--cities', id: data.cityId } }
      : { data: null };
  }
  if (data.countryId !== undefined) {
    relationships.field_country = data.countryId
      ? { data: { type: 'taxonomy_term--countries', id: data.countryId } }
      : { data: null };
  }
  if (data.imageId !== undefined) {
    relationships.field_image = data.imageId
      ? { data: { type: 'file--file', id: data.imageId } }
      : { data: null };
  }

  const slots = data.featuredBusinessIds ?? [null, null, null];
  relationships.field_featured_business_1 = {
    data: slots[0] ? { type: 'node--business', id: slots[0] } : null,
  };
  relationships.field_featured_business_2 = {
    data: slots[1] ? { type: 'node--business', id: slots[1] } : null,
  };
  relationships.field_featured_business_3 = {
    data: slots[2] ? { type: 'node--business', id: slots[2] } : null,
  };

  // Always patch the original-language node, using the entity's langcode to
  // build the correct language-prefix URL.
  const raw = await drupalPatchBase<any>(`/node/tour/${tourId}`, {
    data: {
      type: 'node--tour',
      id: tourId,
      attributes: {
        title: data.title,
        field_description: { value: data.description, format: 'basic_html' },
        field_duration: data.duration,
      },
      relationships,
    },
  }, langcode);
  return mapDrupalTour(raw);
}

// ── Tour Steps ────────────────────────────────────────────────────────────────

export async function createTourStep(
  tourId: string,
  data: {
    title: string;
    description: string;
    order: number;
    lat?: number;
    lon?: number;
    duration?: number;
    featuredBusinessId?: string | null;
    /** Language code for the new step; defaults to the current UI language. */
    langcode?: string;
  }
): Promise<TourStep> {
  const attributes: Record<string, any> = {
    title: data.title,
    field_description: { value: data.description, format: 'basic_html' },
    field_order: data.order,
  };
  if (data.lat !== undefined && data.lon !== undefined && !isNaN(data.lat) && !isNaN(data.lon)) {
    attributes.field_location = buildGeoFieldValue(data.lat, data.lon);
  }
  if (data.duration !== undefined) {
    attributes.field_duration = data.duration;
  }

  const relationships: Record<string, any> = {
    field_tour: { data: { type: 'node--tour', id: tourId } },
  };
  if (data.featuredBusinessId !== undefined) {
    relationships.field_featured_business = {
      data: data.featuredBusinessId ? { type: 'node--business', id: data.featuredBusinessId } : null,
    };
  }

  // Set step language: use the explicitly-provided langcode if given,
  // otherwise fall back to the current UI language.
  attributes.langcode = data.langcode ?? getApiLanguage();

  const raw = await drupalPost<any>('/node/tour_step', {
    data: {
      type: 'node--tour_step',
      attributes,
      relationships,
    },
  });
  return mapDrupalTourStep(raw);
}

export async function updateTourStep(
  stepId: string,
  data: {
    title: string;
    description: string;
    order: number;
    lat?: number;
    lon?: number;
    duration?: number;
    featuredBusinessId?: string | null;
  },
  langcode?: string
): Promise<TourStep> {
  const attributes: Record<string, any> = {
    title: data.title,
    field_description: { value: data.description, format: 'basic_html' },
    field_order: data.order,
  };
  if (data.lat !== undefined && data.lon !== undefined && !isNaN(data.lat) && !isNaN(data.lon)) {
    attributes.field_location = buildGeoFieldValue(data.lat, data.lon);
  } else if (data.lat === undefined && data.lon === undefined) {
    // clear the location when both coords are absent
    attributes.field_location = null;
  }
  if (data.duration !== undefined) {
    attributes.field_duration = data.duration;
  }

  const relationships: Record<string, any> = {};
  if (data.featuredBusinessId !== undefined) {
    relationships.field_featured_business = {
      data: data.featuredBusinessId ? { type: 'node--business', id: data.featuredBusinessId } : null,
    };
  }

  // Always patch the original-language node, using the entity's langcode to
  // build the correct language-prefix URL.
  const raw = await drupalPatchBase<any>(`/node/tour_step/${stepId}`, {
    data: {
      type: 'node--tour_step',
      id: stepId,
      attributes,
      relationships,
    },
  }, langcode);
  return mapDrupalTourStep(raw);
}

export async function deleteTourStep(stepId: string): Promise<void> {
  await drupalDelete(`/node/tour_step/${stepId}`);
}

// ── Professional Profile ──────────────────────────────────────────────────────

export async function getProfessionalProfile(userId: string): Promise<ProfessionalProfile | null> {
  const params = [
    `filter[field_user.id]=${userId}`,
    'fields[node--professional_profile]=id,field_full_name,field_tax_id,field_address,field_account_holder,field_bank_iban,field_bank_bic,field_revenue_percentage,field_user',
  ].join('&');
  const raw = await drupalGet<any[]>('/node/professional_profile', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.length > 0 ? mapDrupalProfessionalProfile(list[0]) : null;
}

export interface ProfileUpdates {
  fullName: string;
  taxId: string;
  accountHolder: string;
  iban: string;
  bic: string;
  addressLine1: string;
  addressLine2: string;
  locality: string;
  postalCode: string;
  countryCode: string;
  administrativeArea: string;
}

/**
 * Splits a full name into given_name + family_name for the Address module.
 * The Address module for Spain requires both fields to be non-empty.
 * We use the first word as given_name and the rest as family_name.
 * If there's only one word, we duplicate it (e.g. "Empresa" → given:"Empresa" family:"Empresa").
 */
function splitFullName(fullName: string): { given_name: string; family_name: string } {
  const parts = (fullName || 'Unknown').trim().split(/\s+/);
  return {
    given_name: parts[0] || 'Unknown',
    family_name: parts.length > 1 ? parts.slice(1).join(' ') : parts[0] || 'Unknown',
  };
}

export async function createProfessionalProfile(
  userId: string,
  updates: ProfileUpdates
): Promise<void> {
  const { given_name, family_name } = splitFullName(updates.fullName);
  await drupalPost('/node/professional_profile', {
    data: {
      type: 'node--professional_profile',
      attributes: {
        title: `Professional Profile - ${userId}`,
        field_full_name: updates.fullName,
        field_tax_id: updates.taxId,
        field_account_holder: updates.accountHolder,
        field_bank_iban: updates.iban,
        field_bank_bic: updates.bic,
        field_address: {
          country_code: updates.countryCode || 'ES',
          given_name,
          family_name,
          address_line1: updates.addressLine1,
          address_line2: updates.addressLine2 ?? '',
          locality: updates.locality,
          postal_code: updates.postalCode,
          administrative_area: updates.administrativeArea ?? '',
        },
      },
      relationships: {
        field_user: {
          data: { type: 'user--user', id: userId },
        },
      },
    },
  });
}

export async function updateProfessionalProfile(
  profileId: string,
  updates: Partial<ProfileUpdates>
): Promise<void> {
  const attributes: Record<string, any> = {};
  if (updates.fullName !== undefined) attributes.field_full_name = updates.fullName;
  if (updates.taxId !== undefined) attributes.field_tax_id = updates.taxId;
  if (updates.accountHolder !== undefined) attributes.field_account_holder = updates.accountHolder;
  if (updates.iban !== undefined) attributes.field_bank_iban = updates.iban;
  if (updates.bic !== undefined) attributes.field_bank_bic = updates.bic;
  if (
    updates.addressLine1 !== undefined ||
    updates.locality !== undefined ||
    updates.postalCode !== undefined ||
    updates.countryCode !== undefined
  ) {
    const { given_name, family_name } = splitFullName(updates.fullName ?? '');
    attributes.field_address = {
      country_code: updates.countryCode || 'ES',
      given_name,
      family_name,
      address_line1: updates.addressLine1 ?? '',
      address_line2: updates.addressLine2 ?? '',
      locality: updates.locality ?? '',
      postal_code: updates.postalCode ?? '',
      administrative_area: updates.administrativeArea ?? '',
    };
  }

  await drupalPatch(`/node/professional_profile/${profileId}`, {
    data: {
      type: 'node--professional_profile',
      id: profileId,
      attributes,
    },
  });
}

// ── Subscription ──────────────────────────────────────────────────────────────

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const params = [
    'filter[status]=1',
    'filter[field_plan_type]=premium',
    'sort=field_price',
  ].join('&');
  const raw = await drupalGet<any[]>('/node/subscription_plan', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(mapDrupalSubscriptionPlan);
}

export async function getActiveSubscription(userId: string): Promise<Subscription | null> {
  const params = [
    `filter[field_user.id]=${userId}`,
    buildInclude(['field_plan']),
    'sort=-field_end_date',
    'page[limit]=5',
    'fields[node--subscription]=id,field_user,field_plan,field_subscription_status,field_start_date,field_end_date,field_auto_renewal,field_stripe_subscription_id,field_stripe_customer_id',
  ].join('&');
  const raw = await drupalGet<any[]>('/node/subscription', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (list.length === 0) return null;
  const mapped = list.map(mapDrupalSubscription);
  // Return the subscription with the latest end date that is still active or cancelled-within-period
  const now = new Date();
  const valid = mapped.filter(s =>
    (s.status === 'active' || s.status === 'cancelled') &&
    new Date(s.endDate) > now
  );
  return valid.length > 0 ? valid[0] : null;
}

export async function getSubscriptionPayments(subscriptionId: string): Promise<SubscriptionPayment[]> {
  const params = [
    `filter[field_subscription.id]=${subscriptionId}`,
    'sort=-field_period_start',
    buildInclude(['field_plan']),
    'fields[node--subscription_payment]=id,field_subscription,field_user,field_plan,field_amount,field_stripe_invoice_id,field_stripe_payment_intent,field_payment_status,field_period_start,field_period_end',
    'fields[node--subscription_plan]=title',
  ].join('&');
  const raw = await drupalGet<any[]>('/node/subscription_payment', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(mapDrupalSubscriptionPayment);
}

export async function getPaymentHistoryByUser(userId: string): Promise<SubscriptionPayment[]> {
  const params = [
    `filter[field_user.id]=${userId}`,
    'sort=-field_period_start',
    buildInclude(['field_plan']),
    'fields[node--subscription_payment]=id,field_subscription,field_user,field_plan,field_amount,field_stripe_invoice_id,field_stripe_payment_intent,field_payment_status,field_period_start,field_period_end',
    'fields[node--subscription_plan]=title',
  ].join('&');
  const raw = await drupalGet<any[]>('/node/subscription_payment', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(mapDrupalSubscriptionPayment);
}

export async function updateSubscription(
  subscriptionId: string,
  autoRenewal: boolean
): Promise<void> {
  await drupalPatch(`/node/subscription/${subscriptionId}`, {
    data: {
      type: 'node--subscription',
      id: subscriptionId,
      attributes: {
        field_auto_renewal: autoRenewal,
      },
    },
  });
}

// ── Donations ─────────────────────────────────────────────────────────────────

export async function getDonationsForAuthor(
  userId: string
): Promise<{ donations: Donation[]; total: number }> {
  const tours = await getToursByAuthor(userId);
  if (tours.length === 0) return { donations: [], total: 0 };

  const allDonations: Donation[] = [];
  for (const tour of tours) {
    const params = [
      `filter[field_tour.id]=${tour.id}`,
      buildInclude(['field_user', 'field_tour']),
      'sort=-created',
    ].join('&');
    const raw = await drupalGet<any[]>('/node/donation', params);
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    allDonations.push(...list.map(mapDrupalDonation));
  }

  const total = allDonations.reduce((sum, d) => sum + d.amount, 0);
  return { donations: allDonations, total };
}
