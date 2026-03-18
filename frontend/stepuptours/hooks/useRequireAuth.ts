// hooks/useRequireAuth.ts
// Auth guard hook — checks if the user is authenticated.
// Redirect / modal logic is left to the consuming component.

import { useAuthStore } from '../stores/auth.store';
import type { User } from '../types';

type AuthResult =
  | { isAuthenticated: true; user: User }
  | { isAuthenticated: false; user: null };

export function useRequireAuth(): AuthResult {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return { isAuthenticated: false, user: null };
  }

  return { isAuthenticated: true, user };
}
