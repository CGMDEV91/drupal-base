// stores/tours.store.ts
// Estado global de tours

import { create } from 'zustand';
import {
  getTours,
  getTourById,
  getTourSteps,
  getTourActivity,
  upsertTourActivity,
  getUserTourActivities,
  getCountries,
  getCitiesByCountry,
} from '../services/tours.service';
import type {
  Tour,
  TourStep,
  TourActivity,
  TourFilters,
  PaginatedResult,
} from '../types';

interface ToursState {
  // Listado
  tours: Tour[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  filters: TourFilters;

  // Detalle
  currentTour: Tour | null;
  currentSteps: TourStep[];
  currentActivity: TourActivity | null;
  isLoadingDetail: boolean;

  // Actividades del usuario (keyed by tourId)
  userActivities: Record<string, TourActivity>;

  // Filtros
  countries: { id: string; name: string }[];
  cities: { id: string; name: string }[];

  // Actions
  fetchTours: (filters?: TourFilters, append?: boolean) => Promise<void>;
  fetchTourDetail: (id: string, userId?: string) => Promise<void>;
  updateActivity: (
    userId: string,
    tourId: string,
    updates: Partial<Pick<TourActivity, 'isFavorite' | 'isSaved' | 'isCompleted' | 'userRating' | 'stepsCompleted'>>
  ) => Promise<void>;
  fetchUserActivities: (userId: string) => Promise<void>;
  toggleFavorite: (userId: string, tourId: string) => Promise<void>;
  fetchCountries: () => Promise<void>;
  fetchCities: (country?: string) => Promise<void>;
  setFilters: (filters: Partial<TourFilters>) => void;
  clearFilters: () => void;
  clearError: () => void;
}

const DEFAULT_FILTERS: TourFilters = {
  page: 1,
  limit: 20,
};

export const useToursStore = create<ToursState>((set, get) => ({
  tours: [],
  total: 0,
  hasMore: false,
  isLoading: false,
  error: null,
  filters: DEFAULT_FILTERS,

  currentTour: null,
  currentSteps: [],
  currentActivity: null,
  isLoadingDetail: false,

  userActivities: {},

  countries: [],
  cities: [],

  fetchTours: async (filters = {}, append = false) => {
    set({ isLoading: true, error: null });
    try {
      const mergedFilters = { ...get().filters, ...filters };
      const result: PaginatedResult<Tour> = await getTours(mergedFilters);

      set((state) => ({
        tours: append ? [...state.tours, ...result.data] : result.data,
        total: result.total,
        hasMore: result.hasMore,
        filters: mergedFilters,
        isLoading: false,
      }));
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Error al cargar tours' });
    }
  },

  fetchTourDetail: async (id, userId) => {
    set({ isLoadingDetail: true, error: null, currentTour: null, currentSteps: [], currentActivity: null });
    try {
      const [tour, steps] = await Promise.all([
        getTourById(id),
        getTourSteps(id),
      ]);

      let activity: TourActivity | null = null;
      if (userId) {
        activity = await getTourActivity(userId, id);
      }

      set({ currentTour: tour, currentSteps: steps, currentActivity: activity, isLoadingDetail: false });
    } catch (err: any) {
      set({ isLoadingDetail: false, error: err.message ?? 'Error al cargar el tour' });
    }
  },

updateActivity: async (userId, tourId, updates) => {
  const prev = get().currentActivity;
  if (prev) {
    set({ currentActivity: { ...prev, ...updates } });
  }
  try {
    const activity = await upsertTourActivity(
      userId,
      tourId,
      updates,
      get().currentTour?.ratingCount
    );

    set({ currentActivity: activity });

    if (updates.userRating !== undefined && !prev?.userRating) {
      set((state) => ({
        currentTour: state.currentTour
          ? { ...state.currentTour, ratingCount: (state.currentTour.ratingCount ?? 0) + 1 }
          : null,
      }));
    }
  } catch (err: any) {
    console.error('→ updateActivity error:', err);
    set({ currentActivity: prev, error: err.message ?? 'Error updating Tour activity' });
  }
},

  fetchUserActivities: async (userId) => {
    try {
      const activities = await getUserTourActivities(userId);
      const map: Record<string, TourActivity> = {};
      for (const activity of activities) {
        map[activity.tourId] = activity;
      }
      set({ userActivities: map });
    } catch {
      // No crítico — el usuario simplemente no verá favoritos/completados
    }
  },

  toggleFavorite: async (userId, tourId) => {
    const previous = get().userActivities[tourId] ?? null;
    const currentIsFavorite = previous?.isFavorite ?? false;
    const optimistic: TourActivity = previous
      ? { ...previous, isFavorite: !currentIsFavorite }
      : {
          id: '',
          tourId,
          userId,
          isFavorite: true,
          isSaved: false,
          isCompleted: false,
          userRating: null,
          stepsCompleted: [],
          completedAt: null,
          ratedAt: null,
          xpAwarded: false,
        };

    // Optimistic update
    set((state) => ({
      userActivities: { ...state.userActivities, [tourId]: optimistic },
    }));

    try {
      const updated = await upsertTourActivity(userId, tourId, { isFavorite: !currentIsFavorite });
      set((state) => ({
        userActivities: { ...state.userActivities, [tourId]: updated },
      }));
    } catch {
      // Revert on error
      set((state) => {
        const reverted = { ...state.userActivities };
        if (previous) {
          reverted[tourId] = previous;
        } else {
          delete reverted[tourId];
        }
        return { userActivities: reverted };
      });
    }
  },

  fetchCountries: async () => {
    try {
      const countries = await getCountries();
      set({ countries });
    } catch {
      // No crítico, ignorar silenciosamente
    }
  },

  fetchCities: async (country?: string) => {
    try {
      const cities = await getCitiesByCountry(country);
      set({ cities });
    } catch {
      // No crítico
    }
  },

  setFilters: (filters) => {
    set((state) => ({ filters: { ...state.filters, ...filters, page: 1 } }));
  },

  clearFilters: () => {
    set({ filters: DEFAULT_FILTERS, cities: [] });
  },

  clearError: () => set({ error: null }),
}));
