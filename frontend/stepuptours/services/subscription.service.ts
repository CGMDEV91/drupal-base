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

export interface CreateSubscriptionResult {
  clientSecret: string;
  subscriptionId: string;  // Stripe Subscription ID (sub_xxx)
  paymentIntentId: string;
  stripeCustomerId: string;
}

/**
 * Creates a Stripe Subscription for the given plan.
 * Returns the clientSecret of the first invoice's PaymentIntent, ready to be
 * confirmed with stripe.confirmCardPayment().
 *
 * The Stripe Subscription handles BOTH the initial charge AND all future
 * auto-renewals — no separate PaymentIntent, no double charges.
 *
 * After confirmation, call activateStripeSubscription().
 */
export async function createStripeSubscription(
  planId: string,
): Promise<CreateSubscriptionResult> {
  const { data } = await axios.post(
    `${BASE_URL}/api/subscription/create`,
    { planId },
    { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } },
  );
  return data;
}

/**
 * After stripe.confirmCardPayment() succeeds, call this to:
 * - Verify the PaymentIntent and attach the PM to the Stripe Subscription
 * - Create the Drupal subscription + subscription_payment nodes
 *
 * subscriptionId = Stripe Subscription ID (sub_xxx) from createStripeSubscription().
 * paymentIntentId = PI ID from confirmCardPayment result.
 */
export async function activateStripeSubscription(data: {
  subscriptionId: string;   // Stripe Subscription ID (sub_xxx)
  paymentIntentId: string;  // PaymentIntent ID from confirmCardPayment
  planId: string;
}): Promise<void> {
  await axios.post(
    `${BASE_URL}/api/subscription/activate`,
    data,
    { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } },
  );
}

/**
 * Cancels the Stripe Subscription immediately via backend.
 * Marks the Drupal subscription as 'cancelled'.
 */
export async function cancelStripeSubscription(
  subscriptionNodeId: string,
): Promise<void> {
  await axios.post(
    `${BASE_URL}/api/subscription/cancel`,
    { subscriptionId: subscriptionNodeId },
    { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } },
  );
}

/**
 * Disables auto-renewal: schedules Stripe Subscription to cancel at period end.
 * Drupal subscription stays active; user retains access until end date.
 */
export async function disableSubscriptionAutoRenewal(
  subscriptionNodeId: string,
): Promise<void> {
  await axios.post(
    `${BASE_URL}/api/subscription/disable-renewal`,
    { subscriptionId: subscriptionNodeId },
    { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } },
  );
}

/**
 * Re-enables auto-renewal: removes cancel_at_period_end from the Stripe
 * Subscription and sets field_auto_renewal = true in Drupal.
 */
export async function enableSubscriptionAutoRenewal(
  subscriptionNodeId: string,
): Promise<void> {
  await axios.post(
    `${BASE_URL}/api/subscription/enable-renewal`,
    { subscriptionId: subscriptionNodeId },
    { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } },
  );
}
