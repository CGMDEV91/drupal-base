// services/subscription.service.ts
import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';

function getAuthHeader(): Record<string, string> {
  const session = useAuthStore.getState().session;
  if (!session?.token) return {};
  return { Authorization: `Basic ${session.token}` };
}

export interface CreateCheckoutSessionResult {
  clientSecret: string;
  checkoutSessionId: string;
}

export interface CheckoutSessionStatus {
  status: 'open' | 'complete' | 'expired';
  paymentStatus: 'paid' | 'unpaid' | 'no_payment_required';
  subscriptionId: string | null;
  customerId: string | null;
}

/**
 * Crea un Stripe CheckoutSession (mode=subscription, ui_mode=elements).
 * Devuelve clientSecret para EmbeddedCheckoutProvider y checkoutSessionId
 * para verificar el estado después del pago.
 */
export async function createStripeCheckoutSession(
  planId: string,
): Promise<CreateCheckoutSessionResult> {
  const { data } = await axios.post(
    `${BASE_URL}/api/subscription/create`,
    { planId },
    { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } },
  );
  return data;
}

/**
 * Verifica el estado del CheckoutSession tras completar el pago.
 * Llamar desde onComplete del EmbeddedCheckoutProvider.
 */
export async function getCheckoutSessionStatus(
  sessionId: string,
): Promise<CheckoutSessionStatus> {
  const { data } = await axios.post(
    `${BASE_URL}/api/subscription/session-status`,
    { sessionId },
    { headers: { 'Content-Type': 'application/json', ...getAuthHeader() } },
  );
  return data;
}

/**
 * Cancela la suscripción al final del período actual.
 * Marca el nodo Drupal como 'cancelled'.
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
 * Desactiva la renovación automática (cancel_at_period_end=true en Stripe).
 * El usuario mantiene acceso hasta la fecha de fin.
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
 * Reactiva la renovación automática (cancel_at_period_end=false en Stripe).
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
