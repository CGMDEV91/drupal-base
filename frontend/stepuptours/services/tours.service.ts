// services/tours.service.ts
// Servicio de tours — agnóstico del backend

import {
  drupalGet,
  drupalGetRaw,
  drupalPost,
  drupalPatch,
  buildFilters,
  buildInclude,
  buildFields,
  buildPage,
  mapDrupalTour,
  mapDrupalTourStep,
  mapDrupalActivity,
} from '../lib/drupal-client';
import type {
  Tour,
  TourStep,
  TourActivity,
  TourFilters,
  PaginatedResult,
} from '../types';

// ── Constantes de campos y relaciones ─────────────────────────────────────────

const TOUR_FIELDS = {
  'node--tour': [
    'title',
    'field_description',
    'field_image',
    'field_average_rate',
    'field_duration',
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
  ],
  'taxonomy_term--cities': ['name'],
  'taxonomy_term--countries': ['name'],
  'file--file': ['uri', 'url'],
};

const TOUR_INCLUDE = [
  'field_image',
  'field_city',
  'field_country',
  'field_featured_business_1',
  'field_featured_business_2',
  'field_featured_business_3',
];

const TOUR_CARD_FIELDS = {
  'node--tour': [
    'title',
    'field_image',
    'field_average_rate',
    'field_duration',
    'field_donation_count',
    'field_city',
    'field_country',
    'status',
  ],
  'taxonomy_term--cities': ['name'],
  'taxonomy_term--countries': ['name'],
  'file--file': ['uri', 'url'],
};

const TOUR_CARD_INCLUDE = ['field_image', 'field_city', 'field_country'];

// ── Obtener listado de tours ───────────────────────────────────────────────────

export async function getTours(filters: TourFilters = {}): Promise<PaginatedResult<Tour>> {
  const { page = 1, limit = 20, country, city, minRating, search } = filters;

  const drupalFilters: Record<string, any> = { status: 1 };
  if (country) drupalFilters['field_country.name'] = country;
  if (city) drupalFilters['field_city.name'] = city;

  const params = [
    buildFilters(drupalFilters),
    minRating ? `filter[rate][condition][path]=field_average_rate&filter[rate][condition][operator]=>=&filter[rate][condition][value]=${minRating}` : '',
    'sort=-field_average_rate',
    buildPage(page, limit),
    buildFields(TOUR_CARD_FIELDS),
    buildInclude(TOUR_CARD_INCLUDE),
  ].filter(Boolean).join('&');

  const { data, meta } = await drupalGetRaw('/node/tour', params);
  const rawList = Array.isArray(data) ? data : [data];

  return {
    data: rawList.map(mapDrupalTour),
    total: meta?.count ?? rawList.length,
    hasMore: rawList.length === limit,
  };
}

// ── Obtener detalle de un tour ────────────────────────────────────────────────

export async function getTourById(id: string): Promise<Tour> {
  const params = [
    buildFields(TOUR_FIELDS),
    buildInclude([...TOUR_INCLUDE, 'uid']),
  ].join('&');

  const raw = await drupalGet<any>(`/node/tour/${id}`, params);
  return mapDrupalTour(raw);
}

// ── Obtener steps de un tour ──────────────────────────────────────────────────

export async function getTourSteps(tourId: string): Promise<TourStep[]> {
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
      ],
      'node--business': ['title', 'field_logo', 'field_website'],
    }),
    buildInclude(['field_featured_business']),
  ].join('&');

  const raw = await drupalGet<any[]>('/node/tour_step', params);
  const rawList = Array.isArray(raw) ? raw : [raw];
  return rawList.map(mapDrupalTourStep);
}

// ── Obtener actividad de un usuario en un tour ────────────────────────────────

export async function getTourActivity(
  userId: string,
  tourId: string
): Promise<TourActivity | null> {
  const params = [
    `filter[field_user.id]=${userId}`,
    `filter[field_tour.id]=${tourId}`,
    buildInclude(['field_steps_completed']),
  ].join('&');

  const raw = await drupalGet<any[]>('/node/tour_user_activity', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.length ? mapDrupalActivity(list[0]) : null;
}

// ── Crear o actualizar actividad de usuario en un tour ────────────────────────

export async function upsertTourActivity(
  userId: string,
  tourId: string,
  updates: Partial<Pick<TourActivity, 'isFavorite' | 'isSaved' | 'isCompleted' | 'userRating' | 'stepsCompleted'>>
): Promise<TourActivity> {
  const existing = await getTourActivity(userId, tourId);

  const attributes: Record<string, any> = {};
  if (updates.isFavorite !== undefined) attributes.field_is_favorite = updates.isFavorite;
  if (updates.isSaved !== undefined) attributes.field_is_saved = updates.isSaved;
  if (updates.isCompleted !== undefined) attributes.field_is_completed = updates.isCompleted;
  if (updates.userRating !== undefined) attributes.field_user_rating = updates.userRating;

  const relationships: Record<string, any> = {
    field_user: { data: { type: 'user--user', id: userId } },
    field_tour: { data: { type: 'node--tour', id: tourId } },
  };

  if (updates.stepsCompleted !== undefined) {
    relationships.field_steps_completed = {
      data: updates.stepsCompleted.map((id) => ({ type: 'node--tour_step', id })),
    };
  }

  if (existing) {
    const raw = await drupalPatch<any>(`/node/tour_user_activity/${existing.id}`, {
      data: {
        type: 'node--tour_user_activity',
        id: existing.id,
        attributes,
        relationships,
      },
    });
    return mapDrupalActivity(raw);
  }

  const raw = await drupalPost<any>('/node/tour_user_activity', {
    data: {
      type: 'node--tour_user_activity',
      attributes,
      relationships,
    },
  });
  return mapDrupalActivity(raw);
}

// ── Obtener todos los tours con actividad del usuario ─────────────────────────

export async function getUserTourActivities(userId: string): Promise<TourActivity[]> {
  const params = [
    `filter[field_user.id]=${userId}`,
    buildFields({
      'node--tour_user_activity': [
        'field_is_favorite',
        'field_is_saved',
        'field_is_completed',
        'field_user_rating',
        'field_completed_at',
        'field_xp_awarded',
      ],
      'node--tour': ['title', 'field_image', 'field_average_rate', 'field_duration', 'field_city'],
      'taxonomy_term--cities': ['name'],
      'file--file': ['uri', 'url'],
    }),
    buildInclude(['field_tour', 'field_tour.field_city', 'field_tour.field_image']),
  ].join('&');

  const raw = await drupalGet<any[]>('/node/tour_user_activity', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(mapDrupalActivity);
}

// ── Obtener países disponibles ─────────────────────────────────────────────────

export async function getCountries(): Promise<{ id: string; name: string }[]> {
  const params = 'sort=name&fields[taxonomy_term--countries]=name';
  const raw = await drupalGet<any[]>('/taxonomy_term/countries', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((item) => ({ id: item.id, name: item.name }));
}

// ── Obtener ciudades por país ─────────────────────────────────────────────────

export async function getCitiesByCountry(countryName: string): Promise<{ id: string; name: string }[]> {
  const params = [
    `filter[field_country.name]=${encodeURIComponent(countryName)}`,
    'sort=name',
    'fields[taxonomy_term--cities]=name',
  ].join('&');

  const raw = await drupalGet<any[]>('/taxonomy_term/cities', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((item) => ({ id: item.id, name: item.name }));
}