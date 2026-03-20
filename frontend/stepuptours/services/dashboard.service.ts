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
} from '../lib/drupal-client';
import type { Tour, TourStep, Donation, ProfessionalProfile, Subscription } from '../types';

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
        status: false, // draft
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
  const params = `filter[field_user.id]=${userId}`;
  const raw = await drupalGet<any[]>('/node/professional_profile', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.length > 0 ? mapDrupalProfessionalProfile(list[0]) : null;
}

export async function updateProfessionalProfile(
  profileId: string,
  updates: Partial<{
    fullName: string;
    taxId: string;
    accountHolder: string;
    iban: string;
    bic: string;
  }>
): Promise<void> {
  const attributes: Record<string, any> = {};
  if (updates.fullName !== undefined) attributes.field_full_name = updates.fullName;
  if (updates.taxId !== undefined) attributes.field_tax_id = updates.taxId;
  if (updates.accountHolder !== undefined) attributes.field_account_holder = updates.accountHolder;
  if (updates.iban !== undefined) attributes.field_bank_iban = updates.iban;
  if (updates.bic !== undefined) attributes.field_bank_bic = updates.bic;

  await drupalPatch(`/node/professional_profile/${profileId}`, {
    data: {
      type: 'node--professional_profile',
      id: profileId,
      attributes,
    },
  });
}

// ── Subscription ──────────────────────────────────────────────────────────────

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
      `filter[field_status]=completed`,
      buildInclude(['field_user', 'field_tour']),
      'sort=-created',
    ].join('&');
    const raw = await drupalGet<any[]>('/node/donation', params);
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    allDonations.push(...list.map(mapDrupalDonation));
  }

  const total = allDonations.reduce((sum, d) => sum + d.guideRevenue, 0);
  return { donations: allDonations, total };
}
