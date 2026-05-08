import { useRouter } from 'next/router';
import { useEffect } from 'react';

import { authStorage } from '@/lib/auth';

export type AuthUser = {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  [key: string]: unknown;
};

/**
 * Lightweight session helper for Pages Router screens (reads client-side storage).
 * Django staff / superadmin rights are enforced by the template APIs (`IsAdminUser`).
 */
export function useAuth() {
  const token = typeof window !== 'undefined' ? authStorage.getAccess() : null;
  const user = typeof window !== 'undefined' ? (authStorage.getUser() as AuthUser | null) : null;
  const isAuthenticated = typeof window !== 'undefined' ? authStorage.isLoggedIn() : false;

  return {
    token,
    user,
    isAuthenticated,
    /** Alias — backend permits staff (`is_staff`); JWT/login payload may omit explicit flags */
    isLikelyStaffSession: Boolean(token && user),
  };
}

/** Redirect to `/dashboard` when no access token is present (after hydration). */
export function useRequireAuthenticatedSession() {
  const router = useRouter();

  useEffect(() => {
    if (!authStorage.isLoggedIn()) {
      void router.replace('/dashboard');
    }
  }, [router]);
}
