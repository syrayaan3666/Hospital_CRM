import { create } from 'zustand';
import type { AuthUser } from '../types';

interface JwtPayload {
  userId?: string;
  email?: string;
  role?: AuthUser['role'];
  name?: string;
  exp?: number;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: AuthUser, accessToken: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  initAuth: () => void;
}

const storageKey = 'hms_access_token';

function base64UrlDecode(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const normalized = padded + '='.repeat((4 - (padded.length % 4)) % 4);

  if (typeof window !== 'undefined') {
    return window.atob(normalized);
  }

  return Buffer.from(normalized, 'base64').toString('utf-8');
}

function decodeToken(token: string): JwtPayload | null {
  const parts = token.split('.');

  if (parts.length !== 3) {
    return null;
  }

  try {
    return JSON.parse(base64UrlDecode(parts[1])) as JwtPayload;
  } catch {
    return null;
  }
}

function isTokenExpired(exp?: number): boolean {
  if (typeof exp !== 'number') {
    return true;
  }

  return exp * 1000 <= Date.now();
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  setAuth: (user, accessToken) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, accessToken);
    }

    set({
      user,
      accessToken,
      isAuthenticated: true,
      isLoading: false,
    });
  },
  clearAuth: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
    }

    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
  },
  setLoading: (loading) => {
    set({ isLoading: loading });
  },
  initAuth: () => {
    set({ isLoading: true });

    if (typeof window === 'undefined') {
      set({ isLoading: false });
      return;
    }

    const token = window.localStorage.getItem(storageKey);

    if (!token) {
      get().clearAuth();
      set({ isLoading: false });
      return;
    }

    const payload = decodeToken(token);

    if (!payload || isTokenExpired(payload.exp)) {
      get().clearAuth();
      set({ isLoading: false });
      return;
    }

    const user: AuthUser = {
      id: payload.userId ?? '',
      email: payload.email ?? '',
      role: payload.role ?? 'PATIENT',
      name: payload.name ?? payload.email ?? '',
    };

    set({
      user,
      accessToken: token,
      isAuthenticated: true,
      isLoading: false,
    });
  },
}));

export default useAuthStore;
