// services/auth.service.ts
// Servicio de autenticación — agnóstico del backend

import axios from 'axios';
import { sessionStorage, inactivityTracker } from '../lib/session';
import { mapDrupalUser } from '../lib/drupal-client';
import type { AuthCredentials, AuthSession, User } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://stepuptours.ddev.site';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extrae un mensaje legible del error, parseando el formato JSON:API de Drupal */
function extractErrorMessage(err: any, fallback: string): string {
  // Drupal devuelve: { errors: [{ detail: '...' }] }
  const detail = err?.response?.data?.errors?.[0]?.detail;
  if (detail) return detail;
  // Axios network error
  if (err?.message) return err.message;
  return fallback;
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login(credentials: AuthCredentials): Promise<AuthSession> {
  // Basic Auth: codifica usuario:password en base64
  const token = btoa(`${credentials.username}:${credentials.password}`);

  // Verifica credenciales obteniendo el perfil del usuario actual
  let response: any;
  try {
    response = await axios.get(
      `${BASE_URL}/jsonapi/user/user?filter[name]=${credentials.username}&fields[user--user]=name,mail,field_public_name,field_experience_points,field_country,user_picture,created&include=field_country`,
      {
        headers: {
          'Accept': 'application/vnd.api+json',
          'Authorization': `Basic ${token}`,
        },
      }
    );
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 401 || status === 403) throw new Error('Credenciales incorrectas');
    throw new Error(extractErrorMessage(err, 'Error al iniciar sesión'));
  }

  const users = response.data?.data ?? [];
  if (!users.length) {
    throw new Error('Credenciales incorrectas');
  }

  // Obtener roles del usuario via endpoint de usuario autenticado
  const rolesResponse = await axios.get(
    `${BASE_URL}/jsonapi/user/user/${users[0].id}?fields[user--user]=roles`,
    {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Authorization': `Basic ${token}`,
      },
    }
  );

  const rawUser = {
    ...users[0].attributes,
    id: users[0].id,
    field_country: users[0].relationships?.field_country?.data
      ? response.data?.included?.find((i: any) => i.id === users[0].relationships.field_country.data.id)?.attributes
      : null,
    roles: rolesResponse.data?.data?.relationships?.roles?.data?.map((r: any) => r.meta?.drupal_internal__target_id) ?? [],
  };

  const user = mapDrupalUser(rawUser);

  const session: AuthSession = {
    token,
    tokenType: 'basic',
    user,
    expiresAt: null, // Basic Auth no expira
  };

  await sessionStorage.saveSession(session);
  inactivityTracker.start(() => {
    // Callback cuando expira por inactividad
    // El store de auth reaccionará via listener
  });

  return session;
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  inactivityTracker.stop();
  await sessionStorage.clearSession();
}

// ── Recuperar sesión activa ───────────────────────────────────────────────────

export async function restoreSession(): Promise<AuthSession | null> {
  const session = await sessionStorage.getSession();
  if (session) {
    inactivityTracker.start(() => {});
  }
  return session;
}

// ── Registro ──────────────────────────────────────────────────────────────────

export async function register(data: {
  username: string;
  email: string;
  password: string;
}): Promise<AuthSession> {
  try {
    await axios.post(
      `${BASE_URL}/api/user/register`,
      { name: data.username, mail: data.email, pass: data.password },
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    // El endpoint devuelve { errors: { field: msg } } o { error: msg }
    const apiErrors = err?.response?.data?.errors;
    if (apiErrors && typeof apiErrors === 'object') {
      const firstField = Object.keys(apiErrors)[0];
      throw new Error(apiErrors[firstField]);
    }
    throw new Error(extractErrorMessage(err, 'Error al registrarse'));
  }

  // Auto-login tras el registro
  return login({ username: data.username, password: data.password });
}

// ── Verificar si está autenticado ─────────────────────────────────────────────

export async function isAuthenticated(): Promise<boolean> {
  return sessionStorage.isAuthenticated();
}

// ── Obtener usuario actual ────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<User | null> {
  return sessionStorage.getUser();
}
