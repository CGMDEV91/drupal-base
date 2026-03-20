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
  const detail = err?.response?.data?.errors?.[0]?.detail;
  if (detail) return detail;
  if (err?.message) return err.message;
  return fallback;
}

/** Obtiene los roles actuales de un usuario desde Drupal JSON:API */
async function fetchUserRoles(userId: string, authHeader: string): Promise<string[]> {
  const res = await axios.get(`${BASE_URL}/api/me`, {
    headers: {
      'Accept': 'application/json',
      'Authorization': authHeader,
    },
  });

  return res.data?.roles ?? [];
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login(credentials: AuthCredentials): Promise<AuthSession> {
  const token = btoa(`${credentials.username}:${credentials.password}`);
  const authHeader = `Basic ${token}`;

  let response: any;
  try {
    response = await axios.get(
      `${BASE_URL}/jsonapi/user/user?filter[name]=${credentials.username}&fields[user--user]=name,mail,field_public_name,field_experience_points,field_country,user_picture,created&include=field_country`,
      {
        headers: {
          'Accept': 'application/vnd.api+json',
          'Authorization': authHeader,
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

  const roles = await fetchUserRoles(users[0].id, authHeader);

  const rawUser = {
    ...users[0].attributes,
    id: users[0].id,
    field_country: users[0].relationships?.field_country?.data
      ? response.data?.included?.find(
          (i: any) => i.id === users[0].relationships.field_country.data.id
        )?.attributes
      : null,
    roles,
  };

  const user = mapDrupalUser(rawUser);

  const session: AuthSession = {
    token,
    tokenType: 'basic',
    user,
    expiresAt: null,
  };

  await sessionStorage.saveSession(session);
  inactivityTracker.start(() => {});

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
  if (!session?.token) return null;

  try {
    // Verificar que el token sigue siendo válido y refrescar roles
    const authHeader = `Basic ${session.token}`;

    const meRes = await axios.get(
      `${BASE_URL}/jsonapi/user/user?filter[name]=${session.user.username}&fields[user--user]=name`,
      {
        headers: {
          'Accept': 'application/vnd.api+json',
          'Authorization': authHeader,
        },
      }
    );

    const users = meRes.data?.data ?? [];
    if (!users.length) {
      // Token inválido — limpiar sesión
      await sessionStorage.clearSession();
      return null;
    }

    // Obtener roles frescos desde Drupal
    const freshRoles = await fetchUserRoles(users[0].id, authHeader);

    const refreshed: AuthSession = {
      ...session,
      user: {
        ...session.user,
        roles: freshRoles,
      },
    };

    await sessionStorage.saveSession(refreshed);
    inactivityTracker.start(() => {});
    return refreshed;

  } catch {
    // Sin red o error inesperado — usar sesión cacheada como fallback
    // para no bloquear el arranque de la app
    inactivityTracker.start(() => {});
    return session;
  }
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
    const apiErrors = err?.response?.data?.errors;
    if (apiErrors && typeof apiErrors === 'object') {
      const firstField = Object.keys(apiErrors)[0];
      throw new Error(apiErrors[firstField]);
    }
    throw new Error(extractErrorMessage(err, 'Error al registrarse'));
  }

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