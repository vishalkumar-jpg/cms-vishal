import { create } from "zustand";
import type { CurrentUser } from "@ob-cms/shared";

/**
 * Session state lives in Zustand (per _CONVENTIONS.md). Holds the current user
 * (with per-site memberships). Active-site selection lives in `siteStore`.
 *
 * Populated from `GET /api/auth/me` (and the login response) via the wrapped
 * auth hooks; cleared on logout.
 */
interface AuthState {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  /** True until the initial `me` bootstrap resolves. */
  isBootstrapping: boolean;
  setUser: (user: CurrentUser | null) => void;
  setBootstrapped: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isBootstrapping: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isBootstrapping: false }),
  setBootstrapped: () => set({ isBootstrapping: false }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));
