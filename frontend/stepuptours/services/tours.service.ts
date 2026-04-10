// services/tours.service.ts
// Servicio de tours — agnóstico del backend

import {
  drupalGet,
  drupalGetRaw,
  drupalGetJsonApi,
  drupalPost,
  drupalPatch,
  buildFilters,
  buildInclude,
  buildFields,
  buildPage,
  mapDrupalTour,
  mapDrupalTourStep,
  mapDrupalActivity,
  extractTourFromActivity,
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
    'field_rating_count',
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
    'langcode',
  ],
  'node--business': ['title', 'field_description', 'field_logo', 'field_website', 'field_phone', 'field_location', 'field_category', 'langcode'],
  'taxonomy_term--cities': ['name'],
  'taxonomy_term--countries': ['name'],
  'taxonomy_term--business_category': ['name'],
  'file--file': ['uri', 'url'],
};

const TOUR_INCLUDE = [
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
];

const TOUR_CARD_FIELDS = {
  'node--tour': [
    'title',
    'field_image',
    'field_average_rate',
    'field_rating_count',
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

// ── Step count cache ──────────────────────────────────────────────────────────
// Avoids a second API round-trip for counts that haven't changed.
// Keyed by tourId; entries expire after 5 minutes.

const STEP_COUNT_CACHE_TTL = 5 * 60 * 1000; // 5 min

interface StepCountEntry {
  count: number;
  expiresAt: number;
}

const stepCountCache = new Map<string, StepCountEntry>();

function getCachedStepCounts(tourIds: string[]): {
  cached: Record<string, number>;
  missing: string[];
} {
  const now = Date.now();
  const cached: Record<string, number> = {};
  const missing: string[] = [];

  for (const id of tourIds) {
    const entry = stepCountCache.get(id);
    if (entry && entry.expiresAt > now) {
      cached[id] = entry.count;
    } else {
      missing.push(id);
    }
  }
  return { cached, missing };
}

function setCachedStepCounts(counts: Record<string, number>): void {
  const expiresAt = Date.now() + STEP_COUNT_CACHE_TTL;
  for (const [id, count] of Object.entries(counts)) {
    stepCountCache.set(id, { count, expiresAt });
  }
}

// ── Batch step count helper ───────────────────────────────────────────────────

async function batchGetStepCounts(tourIds: string[]): Promise<Record<string, number>> {
  if (tourIds.length === 0) return {};

  const { cached, missing } = getCachedStepCounts(tourIds);
  if (missing.length === 0) return cached;

  const filterParts = missing.map(
    (id, i) =>
      `filter[tid][condition][path]=field_tour.id` +
      `&filter[tid][condition][operator]=IN` +
      `&filter[tid][condition][value][${i}]=${id}`
  );

  const params = [
    filterParts.join('&'),
    'filter[status]=1',
    'fields[node--tour_step]=field_tour',
    'page[limit]=500',
  ].join('&');

  try {
    const { data } = await drupalGetRaw('/node/tour_step', params);
    const steps = Array.isArray(data) ? data : data ? [data] : [];

    const fetched: Record<string, number> = {};
    // Initialise to 0 for every missing ID so tours with no steps are also cached
    for (const id of missing) fetched[id] = 0;
    for (const step of steps) {
      const tourId = (step as any).field_tour?.id;
      if (tourId) fetched[tourId] = (fetched[tourId] ?? 0) + 1;
    }

    setCachedStepCounts(fetched);
    return { ...cached, ...fetched };
  } catch {
    return cached; // Return whatever we had cached on error
  }
}

// ── Obtener listado de tours ───────────────────────────────────────────────────

export async function getTours(filters: TourFilters = {}): Promise<PaginatedResult<Tour>> {
  const { page = 1, limit = 20, country, city, minRating, search, sort } = filters;

  const drupalFilters: Record<string, any> = { status: 1 };
  if (country) drupalFilters['field_country.name'] = country;
  if (city) drupalFilters['field_city.name'] = city;

  let sortParam = 'sort=-field_average_rate';
  if (sort === 'alphabetical') sortParam = 'sort=title';
  else if (sort === 'popular') sortParam = 'sort=-field_donation_count';

  const params = [
    buildFilters(drupalFilters),
    minRating ? `filter[rate][condition][path]=field_average_rate&filter[rate][condition][operator]=>=&filter[rate][condition][value]=${minRating}` : '',
    search ? `filter[title][condition][path]=title&filter[title][condition][operator]=CONTAINS&filter[title][condition][value]=${encodeURIComponent(search)}` : '',
    sortParam,
    buildPage(page, limit),
    buildFields(TOUR_CARD_FIELDS),
    buildInclude(TOUR_CARD_INCLUDE),
  ].filter(Boolean).join('&');

  const { data, meta } = await drupalGetRaw('/node/tour', params);
  const rawList = Array.isArray(data) ? data : [data];
  const mapped = rawList.map(mapDrupalTour);

  if (mapped.length > 0) {
    const stepCounts = await batchGetStepCounts(mapped.map((t) => t.id));
    mapped.forEach((t) => {
      t.stopsCount = stepCounts[t.id] ?? 0;
    });
  }

  return {
    data: mapped,
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
  const tour = mapDrupalTour(raw);

  try {
    const stepsRes = await drupalGetRaw(
      '/node/tour_step',
      `filter[field_tour.id]=${raw.id}&filter[status]=1&fields[node--tour_step]=id&page[limit]=100`
    );
    const steps = Array.isArray(stepsRes.data) ? stepsRes.data : stepsRes.data ? [stepsRes.data] : [];
    tour.stopsCount = steps.length;
  } catch {
    tour.stopsCount = 0;
  }

  return tour;
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
        'langcode',
      ],
      'node--business': ['title', 'field_description', 'field_logo', 'field_website', 'field_phone', 'field_location', 'field_category'],
      'taxonomy_term--business_category': ['name'],
      'file--file': ['uri', 'url'],
    }),
    buildInclude(['field_featured_business', 'field_featured_business.field_logo', 'field_featured_business.field_category']),
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
  updates: Partial<Pick<TourActivity, 'isFavorite' | 'isSaved' | 'isCompleted' | 'userRating' | 'stepsCompleted'>>,
  currentTourRatingCount?: number
): Promise<TourActivity> {
  const existing = await getTourActivity(userId, tourId);
  const isNewRating = updates.userRating !== undefined && !existing?.userRating;

const attributes: Record<string, any> = {};
if (updates.isFavorite !== undefined) attributes.field_is_favorite = updates.isFavorite;
if (updates.isSaved !== undefined) attributes.field_is_saved = updates.isSaved;
if (updates.isCompleted !== undefined) {
  attributes.field_is_completed = updates.isCompleted;
  if (updates.isCompleted) {
    attributes.field_completed_at = Math.floor(Date.now() / 1000);
  }
}
if (updates.userRating !== undefined) {
  attributes.field_user_rating = updates.userRating;
  if (isNewRating) {
    attributes.field_rated_at = Math.floor(Date.now() / 1000);
  }
}

  const relationships: Record<string, any> = {
    field_user: { data: { type: 'user--user', id: userId } },
    field_tour: { data: { type: 'node--tour', id: tourId } },
  };

  if (updates.stepsCompleted !== undefined) {
    relationships.field_steps_completed = {
      data: updates.stepsCompleted.map((id) => ({ type: 'node--tour_step', id })),
    };
  }

  let activity: TourActivity;

  if (existing) {
    const raw = await drupalPatch<any>(`/node/tour_user_activity/${existing.id}`, {
      data: {
        type: 'node--tour_user_activity',
        id: existing.id,
        attributes,
        relationships,
      },
    });
    activity = mapDrupalActivity(raw);
  } else {
    const raw = await drupalPost<any>('/node/tour_user_activity', {
      data: {
        type: 'node--tour_user_activity',
        attributes,
        relationships,
      },
    });
    activity = mapDrupalActivity(raw);
  }

  // Incrementar ratingCount solo cuando es un rating nuevo
  if (isNewRating && currentTourRatingCount !== undefined) {
    try {
      await drupalPatch(`/node/tour/${tourId}`, {
        data: {
          type: 'node--tour',
          id: tourId,
          attributes: {
            field_rating_count: currentTourRatingCount + 1,
          },
        },
      });
    } catch {
      // No crítico
    }
  }

  return activity;
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
        'field_tour',
      ],
      'node--tour': [
        'title',
        'field_image',
        'field_average_rate',
        'field_rating_count',
        'field_duration',
        'field_donation_count',
        'field_city',
        'field_country',
        'status',
      ],
      'taxonomy_term--cities': ['name'],
      'taxonomy_term--countries': ['name'],
      'file--file': ['uri', 'url'],
    }),
    buildInclude(['field_tour', 'field_tour.field_city', 'field_tour.field_country', 'field_tour.field_image']),
  ].join('&');

  const raw = await drupalGet<any[]>('/node/tour_user_activity', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map(mapDrupalActivity);
}

// ── Obtener actividades con datos de tour embebidos (una sola petición) ───────

export interface ActivityWithTour {
  activity: TourActivity;
  tour: Tour;
}

export async function getUserActivitiesWithTours(userId: string): Promise<ActivityWithTour[]> {
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
        'field_tour',
      ],
      'node--tour': [
        'title',
        'field_image',
        'field_average_rate',
        'field_rating_count',
        'field_duration',
        'field_donation_count',
        'field_city',
        'field_country',
        'status',
      ],
      'taxonomy_term--cities': ['name'],
      'taxonomy_term--countries': ['name'],
      'file--file': ['uri', 'url'],
    }),
    buildInclude(['field_tour', 'field_tour.field_city', 'field_tour.field_country', 'field_tour.field_image']),
  ].join('&');

  const raw = await drupalGet<any[]>('/node/tour_user_activity', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const results: ActivityWithTour[] = [];
  for (const item of list) {
    const activity = mapDrupalActivity(item);
    const tour = extractTourFromActivity(item);
    if (tour) {
      results.push({ activity, tour });
    }
  }

  if (results.length > 0) {
    const tourIds = results.map((r) => r.tour.id);
    const stepCounts = await batchGetStepCounts(tourIds);
    results.forEach((r) => {
      r.tour.stopsCount = stepCounts[r.tour.id] ?? 0;
    });
  }

  return results;
}

// ── Obtener tours por lista de UUIDs ──────────────────────────────────────────

export async function getToursByIds(ids: string[]): Promise<Tour[]> {
  if (ids.length === 0) return [];

  const filterParts = ids.map(
    (id, i) =>
      `filter[id-group][group][conjunction]=OR&filter[id-${i}][condition][path]=id&filter[id-${i}][condition][value]=${id}&filter[id-${i}][condition][memberOf]=id-group`
  );

  const params = [
    ...filterParts,
    buildFields(TOUR_CARD_FIELDS),
    buildInclude(TOUR_CARD_INCLUDE),
    `page[limit]=${ids.length}`,
  ].join('&');

  const { data } = await drupalGetRaw('/node/tour', params);
  const rawList = Array.isArray(data) ? data : data ? [data] : [];
  const mapped = rawList.map(mapDrupalTour);

  if (mapped.length > 0) {
    const stepCounts = await batchGetStepCounts(mapped.map((t) => t.id));
    mapped.forEach((t) => {
      t.stopsCount = stepCounts[t.id] ?? 0;
    });
  }

  return mapped;
}

// ── Obtener países disponibles ─────────────────────────────────────────────────

export async function getCountries(): Promise<{ id: string; name: string }[]> {
  const params = 'sort=name&fields[taxonomy_term--countries]=name';
  const raw = await drupalGet<any[]>('/taxonomy_term/countries', params);
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((item) => ({ id: item.id, name: item.name }));
}

// ── Obtener ciudades por país ─────────────────────────────────────────────────

export async function getCitiesByCountry(countryName?: string): Promise<{ id: string; name: string }[]> {
  const parts = ['sort=name', 'page[limit]=200', 'fields[taxonomy_term--cities]=name'];
  if (countryName) {
    parts.push(`filter[field_country.name]=${encodeURIComponent(countryName)}`);
  }
  const params = parts.join('&');
  const items = await drupalGetJsonApi('/taxonomy_term/cities', params);
  return items
    .map((item: any) => ({ id: item.id, name: item.attributes?.name ?? '' }))
    .filter((c: { id: string; name: string }) => c.name);
}