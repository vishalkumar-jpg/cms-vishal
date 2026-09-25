import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, type CurrentUser } from "@ob-cms/shared";
import { useAuthStore } from "@/store/authStore";
import { useSiteStore } from "@/store/siteStore";
import {
  type CurrentUserWithTotp,
  disable2faRequest,
  enable2faRequest,
  loginRequest,
  logoutRequest,
  meRequest,
  regenerateBackupCodesRequest,
  setup2faRequest,
  type LoginPayload,
} from "../api/auth.api";

/**
 * Wrapped auth hooks. Components never call the API directly — they call these.
 */

/** Login mutation: authenticates, writes the user into the auth store. */
export const useAdminLogin = () => {
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LoginPayload) => loginRequest(payload),
    onSuccess: (user: CurrentUser) => {
      setUser(user);
      queryClient.setQueryData([QUERY_KEYS.AUTH_ME], user);
    },
  });
};

/** Bootstrap query: fetches the current session on app load. */
export const useCurrentUser = (enabled = true) => {
  const setUser = useAuthStore((s) => s.setUser);
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped);
  return useQuery({
    queryKey: [QUERY_KEYS.AUTH_ME],
    queryFn: async (): Promise<CurrentUserWithTotp | null> => {
      try {
        const user = await meRequest();
        setUser(user);
        return user;
      } catch {
        setUser(null);
        return null;
      } finally {
        setBootstrapped();
      }
    },
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
};

/** Start 2FA enrollment — returns the secret + otpauth URL to render a QR. */
export const useSetup2fa = () => useMutation({ mutationFn: () => setup2faRequest() });

/** Verify a TOTP code and enable 2FA; returns backup codes; refreshes /auth/me. */
export const useEnable2fa = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => enable2faRequest(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AUTH_ME] }),
  });
};

/** Regenerate backup codes (re-verify code or password); returns the new set. */
export const useRegenerateBackupCodes = () =>
  useMutation({
    mutationFn: (args: { code?: string; password?: string }) =>
      regenerateBackupCodesRequest(args),
  });

/** Disable 2FA (code or password); refreshes /auth/me on success. */
export const useDisable2fa = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { code?: string; password?: string }) => disable2faRequest(args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.AUTH_ME] }),
  });
};

/** Logout mutation: clears the API session + local stores. */
export const useAdminLogout = () => {
  const logout = useAuthStore((s) => s.logout);
  const setActiveSiteId = useSiteStore((s) => s.setActiveSiteId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => logoutRequest(),
    onSettled: () => {
      logout();
      setActiveSiteId(null);
      queryClient.clear();
    },
  });
};
