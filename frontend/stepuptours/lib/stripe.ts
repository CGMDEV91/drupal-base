// lib/stripe.ts
// Stripe initialization for web

import { loadStripe, type Stripe } from '@stripe/stripe-js';
import axios from 'axios';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripePromise(): Promise<Stripe | null> {
  // Don't cache a failed/null result — retry on next call
  if (!stripePromise) {
    const attempt = axios
      .get(`${BASE_URL}/api/payment/config`)
      .then((res) => {
        const key = res.data?.publishableKey;
        if (!key || key === 'pk_test_PLACEHOLDER') {
          console.warn('Stripe publishable key not configured');
          stripePromise = null; // allow retry
          return null;
        }
        return loadStripe(key);
      })
      .catch((err) => {
        console.warn('Failed to load Stripe config:', err);
        stripePromise = null; // allow retry
        return null;
      });
    stripePromise = attempt;
  }
  return stripePromise;
}

/**
 * Call after saving new Stripe API keys from the admin panel
 * so the next payment attempt loads the updated publishable key.
 */
export function resetStripePromise(): void {
  stripePromise = null;
}
