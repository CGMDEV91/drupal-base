// types/index.ts
// Tipos del dominio — agnósticos del backend

export type UserRole = 'authenticated' | 'professional' | 'administrator';

export interface User {
  id: string;
  username: string;
  email: string;
  publicName: string;
  preferredLanguage?: string;
  country: Taxonomy | null;
  avatar: string | null;
  experiencePoints: number;
  roles: UserRole[];
  createdAt: string;
}

export interface Taxonomy {
  id: string;
  name: string;
}

export interface GeoLocation {
  lat: number;
  lon: number;
}

export interface Business {
  id: string;
  name: string;
  description: string;
  logo: string | null;
  website: string | null;
  phone: string | null;
  location: GeoLocation | null;
  category: Taxonomy | null;
}

export interface TourStep {
  id: string;
  title: string;
  description: string;
  order: number;
  location: GeoLocation | null;
  totalCompleted: number;
  featuredBusiness: Business | null;
}

export interface Tour {
  id: string;
  drupalInternalId: number;
  title: string;
  description: string;
  image: string | null;
  duration: number;
  averageRate: number;
  ratingCount: number;
  stopsCount: number;
  donationCount: number;
  donationTotal: number;
  city: Taxonomy | null;
  country: Taxonomy | null;
  location: GeoLocation | null;
  featuredBusinesses: (Business | null)[];
  authorId: string;
  published: boolean;
}

export interface TourActivity {
  id: string;
  tourId: string;
  userId: string;
  isFavorite: boolean;
  isSaved: boolean;
  isCompleted: boolean;
  userRating: number | null;
  stepsCompleted: string[];
  completedAt: string | null;
  ratedAt: string | null;
  xpAwarded: boolean;
}

export interface SubscriptionPlan {
  id: string;
  title: string;
  planType: 'free' | 'premium';
  billingCycle: 'monthly' | 'annual' | 'none';
  price: number;
  maxFeaturedDetail: number;
  maxFeaturedSteps: number;   // -1 = unlimited
  maxLanguages: number;       // -1 = unlimited
  featuredPerStep: boolean;
  autoRenewal: boolean;
  active: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  startDate: string;
  endDate: string;
  autoRenewal: boolean;
  lastPaymentAt: string | null;
}

export interface ProfessionalProfile {
  id: string;
  userId: string;
  fullName: string;
  taxId: string;
  address: object | null;
  accountHolder: string;
  revenuePercentage: number;
}

export interface Donation {
  id: string;
  tourId: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  guideRevenue: number;
  platformRevenue: number;
  createdAt: string;
}

// Tipos de paginación y listado
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

export interface TourFilters {
  country?: string;
  city?: string;
  minRating?: number;
  maxDuration?: number;
  search?: string;
  page?: number;
  limit?: number;
  sort?: 'rating' | 'alphabetical' | 'popular';
}

// Tipos de autenticación
export interface AuthCredentials {
  username: string;
  password: string;
}

export interface AuthSession {
  token: string;
  tokenType: 'basic' | 'bearer';
  user: User;
  expiresAt: string | null;
}

// Ranking
export interface RankingEntry {
  position: number;
  userId: string;
  username: string;
  publicName: string;
  avatar: string | null;
  toursCompleted: number;
  totalXp: number;
}
