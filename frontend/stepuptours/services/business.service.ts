// services/business.service.ts
// Business service — agnostic of Drupal internals
// All Drupal-specific mapping happens in drupal-client.ts

import {
  fetchBusinesses,
  fetchBusinessById,
  searchBusinesses,
  createBusinessNode,
  updateBusinessNode,
  deleteBusinessNode,
  fetchBusinessCategories,
  type BusinessInput,
} from '../lib/drupal-client';
import type { Business } from '../types';

export type { BusinessInput };

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getBusinessesByAuthor(userId: string): Promise<Business[]> {
  return fetchBusinesses(userId);
}

export async function getAllBusinesses(): Promise<Business[]> {
  return fetchBusinesses();
}

export async function getBusinessById(id: string): Promise<Business> {
  return fetchBusinessById(id);
}

export async function searchBusinessesByName(
  query: string,
  userId?: string
): Promise<Business[]> {
  if (!query.trim()) {
    return userId ? fetchBusinesses(userId) : fetchBusinesses();
  }
  return searchBusinesses(query, userId);
}

export async function getBusinessCategories(): Promise<{ id: string; name: string }[]> {
  return fetchBusinessCategories();
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function createBusiness(data: BusinessInput): Promise<Business> {
  if (!data.name?.trim()) {
    throw new Error('Business name is required');
  }
  return createBusinessNode(data);
}

export async function updateBusiness(
  id: string,
  data: Partial<BusinessInput>,
  langcode?: string
): Promise<Business> {
  return updateBusinessNode(id, data, langcode);
}

export async function deleteBusiness(id: string): Promise<void> {
  return deleteBusinessNode(id);
}
