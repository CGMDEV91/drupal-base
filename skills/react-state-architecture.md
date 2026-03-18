# Skill: React State & Architecture

Stack tech. Zustand, servicios, tipos, arquitectura de la app React Native.

---

## Principio de Arquitectura

```
[UI Components]
      ↓ usa
[Zustand Stores]  ← estado global reactivoq
      ↓ llama
[Services]        ← lógica de negocio, agnóstica del backend
      ↓ usa
[drupal-client]   ← ÚNICO con conocimiento de Drupal
      ↓
[Drupal JSON:API]
```

**Regla fundamental**: Los componentes nunca llaman directamente a `drupal-client`. Siempre van por el store o el servicio.

---

## Zustand Store — Patrón Base

```typescript
// stores/tours.store.ts
import { create } from 'zustand';
import { getTours, getCountries } from '../services/tours.service';
import type { Tour, TourFilters } from '../types';

interface ToursState {
  // Estado
  tours: Tour[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  filters: TourFilters;
  countries: { id: string; name: string }[];

  // Acciones
  fetchTours: (filters?: Partial<TourFilters>, append?: boolean) => Promise<void>;
  fetchCountries: () => Promise<void>;
  setFilters: (filters: Partial<TourFilters>) => void;
  clearFilters: () => void;
}

export const useToursStore = create<ToursState>((set, get) => ({
  tours: [],
  total: 0,
  hasMore: false,
  isLoading: false,
  error: null,
  filters: { page: 1, limit: 20 },
  countries: [],

  fetchTours: async (newFilters = {}, append = false) => {
    const filters = { ...get().filters, ...newFilters };
    set({ isLoading: true, error: null, filters });
    try {
      const result = await getTours(filters);
      set((state) => ({
        tours: append ? [...state.tours, ...result.data] : result.data,
        total: result.total,
        hasMore: result.hasMore,
        isLoading: false,
      }));
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
    }
  },

  fetchCountries: async () => {
    const countries = await getCountries();
    set({ countries });
  },

  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  clearFilters: () => set({ filters: { page: 1, limit: 20 } }),
}));
```

---

## Auth Store

```typescript
// stores/auth.store.ts
import { create } from 'zustand';
import { login, logout, restoreSession } from '../services/auth.service';
import type { AuthSession, User, AuthCredentials } from '../types';

interface AuthState {
  session: AuthSession | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;

  signIn: (credentials: AuthCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  restore: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: false,
  error: null,

  signIn: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const session = await login(credentials);
      set({ session, user: session.user, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
    }
  },

  signOut: async () => {
    await logout();
    set({ session: null, user: null });
  },

  restore: async () => {
    const session = await restoreSession();
    if (session) set({ session, user: session.user });
  },
}));
```

---

## Patrón de Servicio

Los servicios son funciones puras que:
1. Reciben datos del dominio (TypeScript types)
2. Llaman a `drupal-client` para comunicarse con Drupal
3. Retornan datos del dominio (no estructuras JSON:API)

```typescript
// services/user.service.ts
import { drupalGet, drupalPatch, mapDrupalUser } from '../lib/drupal-client';
import type { User } from '../types';

export async function getUserById(userId: string): Promise<User> {
  const params = [
    'fields[user--user]=name,mail,field_public_name,field_experience_points,field_country,user_picture,created',
    'include=field_country',
  ].join('&');
  const raw = await drupalGet<any>(`/user/user/${userId}`, params);
  return mapDrupalUser(raw);
}

export async function updateUserProfile(
  userId: string,
  updates: { publicName?: string; countryId?: string }
): Promise<User> {
  const body: any = {
    data: {
      type: 'user--user',
      id: userId,
      attributes: {},
      relationships: {},
    },
  };
  if (updates.publicName) body.data.attributes.field_public_name = updates.publicName;
  if (updates.countryId) {
    body.data.relationships.field_country = {
      data: { type: 'taxonomy_term--countries', id: updates.countryId },
    };
  }
  const raw = await drupalPatch<any>(`/user/user/${userId}`, body);
  return mapDrupalUser(raw);
}
```

---

## Drupal Client — Funciones Exportadas

```typescript
// lib/drupal-client.ts (resumen de exports)

// HTTP
drupalGet<T>(endpoint, params?)         // GET + deserializar
drupalGetRaw(endpoint, params?)         // GET + meta + links
drupalPost<T>(endpoint, body)           // POST + deserializar
drupalPatch<T>(endpoint, body)          // PATCH + deserializar
drupalDelete(endpoint)                  // DELETE

// Query builders
buildInclude(relations: string[])       // "include=a,b,c"
buildFields(fields: Record<string, string[]>)  // "fields[type]=f1,f2"
buildFilters(filters: Record<string, any>)     // "filter[k]=v&..."
buildPage(page, limit)                  // "page[limit]=20&page[offset]=0"

// Mappers (Drupal raw → domain type)
mapDrupalUser(raw)
mapDrupalTour(raw)
mapDrupalTourStep(raw)
mapDrupalBusiness(raw)
mapDrupalActivity(raw)
mapDrupalSubscription(raw)
```

---

## Custom Hook — Patrón

```typescript
// hooks/useTourDetail.ts
import { useEffect } from 'react';
import { useToursStore } from '../stores/tours.store';
import { useAuthStore } from '../stores/auth.store';

export function useTourDetail(tourId: string) {
  const { currentTour, currentSteps, currentActivity, fetchTourDetail, isLoading } = useToursStore();
  const { user } = useAuthStore();

  useEffect(() => {
    fetchTourDetail(tourId, user?.id);
  }, [tourId]);

  return { tour: currentTour, steps: currentSteps, activity: currentActivity, isLoading };
}
```

---

## Tipos del Dominio — Estructura

```typescript
// types/index.ts — Organización

// Primitivos
type UserRole = 'authenticated' | 'professional' | 'administrator';
type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'trial';
type DonationStatus = 'pending' | 'completed' | 'failed';

// Entidades
interface User { id, username, email, publicName, country, avatar, experiencePoints, roles, createdAt }
interface Tour { id, title, description, image, duration, averageRate, donationCount, donationTotal, city, country, location, featuredBusinesses, authorId, published }
interface TourStep { id, title, description, order, location, totalCompleted, featuredBusiness }
interface TourActivity { id, tourId, userId, isFavorite, isSaved, isCompleted, userRating, stepsCompleted, completedAt, xpAwarded }
interface Business { id, name, description, logo, website, phone, location, category }
interface Subscription { id, userId, plan, status, startDate, endDate, autoRenewal, lastPaymentAt }
interface SubscriptionPlan { id, title, planType, billingCycle, price, maxFeaturedDetail, maxFeaturedSteps, maxLanguages, featuredPerStep, autoRenewal, active }
interface ProfessionalProfile { id, userId, fullName, taxId, address, accountHolder, bankIban, bankBic, revenuePercentage }
interface Donation { id, tourId, userId, amount, currency, status, guideRevenue, platformRevenue, createdAt }

// Utilitarios
interface GeoLocation { lat: number; lon: number }
interface Taxonomy { id: string; name: string }
interface PaginatedResult<T> { data: T[]; total: number; hasMore: boolean }
interface TourFilters { country?, city?, minRating?, maxDuration?, search?, page?, limit? }
interface AuthSession { token, tokenType, user, expiresAt }
```

---

## React Hook Form + Zod (para formularios)

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const loginSchema = z.object({
  username: z.string().min(3, 'Mínimo 3 caracteres'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginScreen() {
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    await signIn(data);
  };

  return (
    <Controller
      control={control}
      name="username"
      render={({ field: { onChange, value } }) => (
        <TextInput value={value} onChangeText={onChange} />
      )}
    />
  );
}
```

---

## Gestión de Errores

Los stores capturan errores del servicio y los exponen como `error: string | null`.

```typescript
// En componente
const { error, isLoading } = useToursStore();

useEffect(() => {
  if (error) {
    Alert.alert('Error', error);
  }
}, [error]);
```

Los servicios lanzan `Error` con mensaje legible (ya normalizado en `drupal-client.ts`):
```typescript
// drupal-client.ts normalizeError()
function normalizeError(error: any): Error {
  const drupalErrors = error.response?.data?.errors;
  if (drupalErrors?.length) {
    return new Error(drupalErrors[0].detail ?? drupalErrors[0].title);
  }
  return new Error(error.message ?? 'Network error');
}
```
