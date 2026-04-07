// services/auth.service.ts
// Servicio de autenticación — agnóstico del backend

import axios from 'axios';
import { sessionStorage, inactivityTracker } from '../lib/session';
import { mapDrupalUser } from '../lib/drupal-client';
import { getUserById } from './user.service';
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
      `${BASE_URL}/jsonapi/user/user?filter[name]=${credentials.username}&fields[user--user]=name,mail,field_public_name,field_experience_points,field_country,user_picture,created,preferred_langcode,langcode&include=field_country`,
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
    field_country: (() => {
      const rel = users[0].relationships?.field_country?.data;
      if (!rel) return null;
      const inc = response.data?.included?.find((i: any) => i.id === rel.id);
      return inc ? { id: inc.id, ...inc.attributes } : null;
    })(),
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

    const userId = users[0].id;

    // Obtener roles y perfil completo frescos desde Drupal
    const [freshRoles, freshUser] = await Promise.all([
      fetchUserRoles(userId, authHeader),
      getUserById(userId),
    ]);

    const refreshed: AuthSession = {
      ...session,
      user: {
        ...freshUser,
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
  publicName?: string;
  email: string;
  password: string;
  role?: 'professional';
}): Promise<AuthSession> {
  try {
    const payload: Record<string, string> = {
      name: data.username,
      mail: data.email,
      pass: data.password,
    };
    if (data.publicName) payload.field_public_name = data.publicName;
    if (data.role === 'professional') payload.role = 'professional';

    await axios.post(
      `${BASE_URL}/api/user/register`,
      payload,
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

// ── Google Auth ───────────────────────────────────────────────────────────────

export async function loginWithGoogle(googleAccessToken: string, role?: 'professional'): Promise<AuthSession> {
  let response: any;
  try {
    response = await axios.post(
      `${BASE_URL}/api/auth/google`,
      { access_token: googleAccessToken, role: role ?? null },
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    throw new Error(extractErrorMessage(err, 'Google sign-in failed'));
  }

  const { token, username } = response.data;
  // token is base64(username:derivedPassword) — ready to use as Basic Auth
  const authHeader = `Basic ${token}`;

  // Fetch full user profile
  const users = await axios.get(
    `${BASE_URL}/jsonapi/user/user?filter[name]=${encodeURIComponent(username)}&fields[user--user]=name,mail,field_public_name,field_experience_points,field_country,user_picture,created,preferred_langcode,langcode&include=field_country`,
    { headers: { Accept: 'application/vnd.api+json', Authorization: authHeader } }
  );
  const rawUsers = users.data?.data ?? [];
  if (!rawUsers.length) throw new Error('User not found after Google auth');

  const roles = await fetchUserRoles(rawUsers[0].id, authHeader);
  const rawUser = {
    ...rawUsers[0].attributes,
    id: rawUsers[0].id,
    field_country: (() => {
      const rel = rawUsers[0].relationships?.field_country?.data;
      if (!rel) return null;
      const inc = users.data?.included?.find((i: any) => i.id === rel.id);
      return inc ? { id: inc.id, ...inc.attributes } : null;
    })(),
    roles,
  };
  const user = mapDrupalUser(rawUser);
  const session: AuthSession = { token, tokenType: 'basic', user };
  await sessionStorage.saveSession(session);
  return session;
}