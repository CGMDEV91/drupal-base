// services/payment.service.ts
// Payment service layer — agnostic of backend

import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';

function getAuthHeader(): Record<string, string> {
  const session = useAuthStore.getState().session;
  if (!session?.token) return {};
  return { Authorization: `Basic ${session.token}` };
}

export interface DonationIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  guideRevenue: number;
  platformRevenue: number;
}

export interface AdminDonation {
  id: string;
  tourTitle: string;
  tourId: string;
  tourOwnerName: string;
  tourOwnerId: string;
  tourOwnerIsAdmin: boolean;
  donorName: string;
  amount: number;
  currency: string;
  guideRevenue: number;
  platformRevenue: number;
  paymentReference: string;
  createdAt: string;
}

export interface DonationsSummary {
  donationsCount: number;
  totalAmount: number;
  totalGuideRevenue: number;
  totalPlatformRevenue: number;
}

export async function createDonationIntent(
  tourId: string,
  amount: number,
  currency = 'eur',
): Promise<DonationIntentResult> {
  const { data } = await axios.post(
    `${BASE_URL}/api/payment/donation-intent`,
    { tourId, amount, currency },
    { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } },
  );
  return data;
}

export interface DonationActivateResult {
  id: string;
  amount: number;
  guideRevenue: number;
  platformRevenue: number;
  paymentReference: string;
  currency: string;
  createdAt: number;
}

export async function activateDonation(
  paymentIntentId: string,
): Promise<DonationActivateResult> {
  const { data } = await axios.post(
    `${BASE_URL}/api/payment/donation-activate`,
    { paymentIntentId },
    { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } },
  );
  return data;
}

export async function getAdminDonations(): Promise<AdminDonation[]> {
  const { data } = await axios.get(`${BASE_URL}/api/admin/donations`, {
    headers: getAuthHeader(),
  });
  return data;
}

export async function getAdminDonationsSummary(): Promise<DonationsSummary> {
  const { data } = await axios.get(`${BASE_URL}/api/admin/donations/summary`, {
    headers: getAuthHeader(),
  });
  return data;
}
