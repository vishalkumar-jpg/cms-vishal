import { hasRoleAtLeast, type Role } from "@ob-cms/shared";
import { useAuthStore } from "@/store/authStore";
import { useSiteStore } from "@/store/siteStore";

/**
 * The current user's role on the active site (B14 editorial workflow gating).
 * Platform admins are treated as `super_admin` everywhere. Returns `null` when
 * there is no user / no active site / no membership for it.
 */
export const useActiveRole = (): Role | null => {
  const user = useAuthStore((s) => s.user);
  const siteId = useSiteStore((s) => s.activeSiteId);
  if (!user) return null;
  if (user.isPlatformAdmin) return "super_admin";
  if (!siteId) return null;
  const membership = user.memberships.find((m) => m.siteId === siteId);
  return membership?.role ?? null;
};

/** True when the active-site role is at least `editor` (can approve/reject/publish). */
export const useCanReview = (): boolean => {
  const role = useActiveRole();
  return role != null && hasRoleAtLeast(role, "editor");
};

/** The current user's id (used to resolve the "assigned to me" review queue). */
export const useCurrentUserId = (): string | null =>
  useAuthStore((s) => s.user?.id ?? null);
