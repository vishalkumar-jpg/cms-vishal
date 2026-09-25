import * as React from "react";
import { Navigate, Outlet } from "react-router";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useCurrentUser } from "@/views/auth/hooks/useAuth";
import { setUnauthorizedHandler } from "@/services/AxiosService";

/**
 * Route guard. Bootstraps the session via `GET /api/auth/me` on first mount,
 * shows a spinner while resolving, then either renders the app or redirects to
 * login. Also registers the global 401 -> logout handler.
 */
export const ProtectedRoute: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const logout = useAuthStore((s) => s.logout);

  // Bootstrap the session (sets the auth store + clears isBootstrapping).
  useCurrentUser();

  React.useEffect(() => {
    setUnauthorizedHandler(() => logout());
  }, [logout]);

  if (isBootstrapping) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
