// services/subscription.service.ts
// Subscription payment flow — agnostic of backend internals

import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';

function getAuthHeader(): Record<string, string> {
  const session = useAuthStore.getState().session;
  if (!session?.token) return {};
  return { Authorization: `Basic ${session.token}` };
}

export interface SubscriptionIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  planTitle: string;
  price: number;
  billingCycle: string;
}

export interface ActivatedSubscription {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  autoRenewal: boolean;
  planId: string;
  planTitle: string;
  billingCycle: string;
  price: number;
}

/**
 * Creates a Stripe PaymentIntent for the given subscription plan.
 */
export async function createSubscriptionIntent(
  planId: string,
  autoRenewal = true,
): Promise<SubscriptionIntentResult> {
  const { data } = await axios.post(
    `${BASE_URL}/api/subscription/intent`,
    { planId, autoRenewal },
    { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } },
  );
  return data;
}

/**
 * Called after Stripe payment is confirmed.
 * Verifies the PaymentIntent server-side and creates the subscription node.
 * Idempotent — safe to call even if the webhook already processed it.
 */
export async function activateSubscription(
  paymentIntentId: string,
  planId: string,
  autoRenewal = true,
): Promise<ActivatedSubscription> {
  const { data } = await axios.post(
    `${BASE_URL}/api/subscription/activate`,
    { paymentIntentId, planId, autoRenewal },
    { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } },
  );
  return data;
}
