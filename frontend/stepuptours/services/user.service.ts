// services/user.service.ts
// Servicio de usuario — agnóstico del backend

import {
  drupalGet,
  drupalPatch,
  buildFields,
  buildInclude,
  mapDrupalUser,
  mapDrupalSubscription,
} from '../lib/drupal-client';
import type { User, Subscription } from '../types';

// ── Obtener perfil de usuario por ID ─────────────────────────────────────────

export async function getUserById(userId: string): Promise<User> {
  const params = [
    buildFields({
      'user--user': [
        'name',
        'mail',
        'field_public_name',
        'field_experience_points',
        'field_country',
        'user_picture',
        'created',
      ],
      'taxonomy_term--countries': ['name'],
    }),
    buildInclude(['field_country']),
  ].join('&');

  const raw = await drupalGet<any>(`/user/user/${userId}`, params);
  return mapDrupalUser(raw);
}

// ── Actualizar perfil de usuario ──────────────────────────────────────────────

export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<User, 'publicName' | 'country'>>
): Promise<User> {
  const attributes: Record<string, any> = {};
  const relationships: Record<string, any> = {};

  if (updates.publicName !== undefined) {
    attributes.field_public_name = updates.publicName;
  }

  if (updates.country !== undefined) {
    relationships.field_country = updates.country
      ? { data: { type: 'taxonomy_term--countries', id: updates.country.id } }
      : { data: null };
  }

  const raw = await drupalPatch<any>(`/user/user/${userId}`, {
    data: {
      type: 'user--user',
      id: userId,
      attributes,
      relationships,
    },
  });

  return mapDrupalUser(raw);
}

// ── Obtener suscripción activa ────────────────────────────────────────────────

export async function getActiveSubscription(userId: string): Promise<Subscription | null> {
  const params = [
    `filter[field_user.id]=${userId}`,
    `filter[field_subscription_status]=active`,
    buildFields({
      'node--subscription': [
        'field_subscription_status',
        'field_start_date',
        'field_end_date',
        'field_auto_renewal',
        'field_last_payment_at',
      ],
      'node--subscription_plan': [
        'title',
        'field_plan_type',
        'field_price',
        'field_billing_cycle',
        'field_max_featured_detail',
        'field_max_featured_steps',
        'field_max_languages',
        'field_featured_per_step',
      ],
    }),
    buildInclude(['field_plan']),
  ].join('&');

  const raw = await drupalGet<any[]>('/node/subscription', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.length ? mapDrupalSubscription(list[0]) : null;
}

// ── Obtener planes de suscripción disponibles ─────────────────────────────────

export async function getSubscriptionPlans(): Promise<import('../types').SubscriptionPlan[]> {
  const params = [
    'filter[status]=1',
    'sort=field_price',
    buildFields({
      'node--subscription_plan': [
        'title',
        'field_plan_type',
        'field_billing_cycle',
        'field_price',
        'field_max_featured_detail',
        'field_max_featured_steps',
        'field_max_languages',
        'field_featured_per_step',
        'field_auto_renewal',
        'status',
      ],
    }),
  ].join('&');

  const raw = await drupalGet<any[]>('/node/subscription_plan', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return list.map((item) => ({
    id: item.id,
    title: item.title ?? '',
    planType: item.field_plan_type ?? 'free',
    billingCycle: item.field_billing_cycle ?? 'none',
    price: parseFloat(item.field_price ?? '0'),
    maxFeaturedDetail: item.field_max_featured_detail ?? 1,
    maxFeaturedSteps: item.field_max_featured_steps ?? 3,
    maxLanguages: item.field_max_languages ?? 5,
    featuredPerStep: item.field_featured_per_step ?? false,
    autoRenewal: item.field_auto_renewal ?? false,
    active: item.status ?? true,
  }));
}
