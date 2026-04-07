// services/googleAuth.service.ts
// Google OAuth via Identity Services library (web-only, no extra packages needed)
// For native: requires @react-native-google-signin/google-signin (not yet implemented)

import { Platform } from 'react-native';

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

let gsiLoaded = false;

function ensureGSI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (gsiLoaded || (window as any).google?.accounts) {
    gsiLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => { gsiLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
}

/** Returns a Google access_token by opening Google's OAuth popup */
export async function getGoogleAccessToken(): Promise<string> {
  if (Platform.OS !== 'web') {
    throw new Error('Google sign-in on native requires additional configuration');
  }
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('EXPO_PUBLIC_GOOGLE_CLIENT_ID is not configured');
  }
  await ensureGSI();

  return new Promise((resolve, reject) => {
    const g = (window as any).google;
    const client = g.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'email profile openid',
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error_description ?? response.error));
        } else {
          resolve(response.access_token as string);
        }
      },
    });
    client.requestAccessToken({ prompt: '' });
  });
}
