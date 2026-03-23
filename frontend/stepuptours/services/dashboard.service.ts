// services/dashboard.service.ts
// Dashboard service — agnostic of Drupal internals
// All Drupal-specific mapping happens in drupal-client.ts

import {
  drupalGet,
  drupalPost,
  drupalPatch,
  drupalDelete,
  buildInclude,
  mapDrupalTour,
  mapDrupalTourStep,
  mapDrupalDonation,
  mapDrupalProfessionalProfile,
  mapDrupalSubscription,
  mapDrupalSubscriptionPlan,
} from '../lib/drupal-client';
import type { Tour, TourStep, Donation, ProfessionalProfile, Subscription, SubscriptionPlan } from '../types';

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

export async function createTour(data: {
  title: string;
  description: string;
  duration: number;
  cityId?: string;
  countryId?: string;
}): Promise<Tour> {
  const relationships: Record<string, any> = {};
  if (data.cityId) {
    relationships.field_city = { data: { type: 'taxonomy_term--cities', id: data.cityId } };
  }
  if (data.countryId) {
    relationships.field_country = { data: { type: 'taxonomy_term--countries', id: data.countryId } };
  }

  const raw = await drupalPost<any>('/node/tour', {
    data: {
      type: 'node--tour',
      attributes: {
        title: data.title,
        field_description: { value: data.description, format: 'basic_html' },
        field_duration: data.duration,

      },
      relationships,
    },
  });
  return mapDrupalTour(raw);
}

// ── Tour Steps ────────────────────────────────────────────────────────────────

export async function createTourStep(
  tourId: string,
  data: { title: string; description: string; order: number }
): Promise<TourStep> {
  const raw = await drupalPost<any>('/node/tour_step', {
    data: {
      type: 'node--tour_step',
      attributes: {
        title: data.title,
        field_description: { value: data.description, format: 'basic_html' },
        field_order: data.order,
      },
      relationships: {
        field_tour: { data: { type: 'node--tour', id: tourId } },
      },
    },
  });
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
    `filter[field_subscription_status]=active`,
    buildInclude(['field_plan']),
  ].join('&');
  const raw = await drupalGet<any[]>('/node/subscription', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.length > 0 ? mapDrupalSubscription(list[0]) : null;
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
