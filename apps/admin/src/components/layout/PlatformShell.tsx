import * as React from "react";
import { Navigate, Outlet, useNavigate, Link } from "react-router";
import {
  LayoutDashboard,
  Globe,
  ArrowLeft,
  ShieldCheck,
  LogOut,
  Moon,
  Sun,
  Database,
  Menu as MenuIcon,
} from "lucide-react";
import { Button } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { toggleTheme } from "@/store/slices/themeSlice";
import { useAuthStore } from "@/store/authStore";
import { useAdminLogout } from "@/views/auth/hooks/useAuth";
import { AdminSidebarNav } from "./AdminSidebarNav";
import { MobileNavDrawer } from "./MobileNavDrawer";

const NAV: { to: string; label: string; icon: typeof LayoutDashboard }[] = [
  { to: "/platform", label: "Overview", icon: LayoutDashboard },
  { to: "/platform/sites", label: "Sites", icon: Globe },
  { to: "/platform/backups", label: "Backups", icon: Database },
];

/**
 * Platform-admin console shell. A deliberately distinct, light chrome (no
 * SiteSwitcher — this area is cross-tenant) branded "Platform Admin". Loads
 * ONLY for platform admins; everyone else is bounced to /dashboard. Assumes the
 * parent ProtectedRoute already bootstrapped the session.
 */
export const PlatformShell: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const dispatch = useAppDispatch();
  const mode = useAppSelector((s) => s.theme.mode);
  const logout = useAdminLogout();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  if (!user?.isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const onLogout = (): void => {
    logout.mutate();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <Link to="/platform" className="text-sm font-bold tracking-tight hover:text-primary">
            Platform Admin
          </Link>
        </div>
        <AdminSidebarNav
          groups={[{ items: NAV }]}
          endMatchers={{ "/platform": true }}
        />
        <div className="border-t border-border p-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to site admin
          </Link>
        </div>
      </aside>

      <MobileNavDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        title={
          <Link
            to="/platform"
            onClick={() => setMobileNavOpen(false)}
            className="flex items-center gap-2 text-sm font-bold tracking-tight hover:text-primary"
          >
            <ShieldCheck className="h-5 w-5 text-primary" />
            Platform Admin
          </Link>
        }
        footer={
          <div className="p-3">
            <Link
              to="/dashboard"
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to site admin
            </Link>
          </div>
        }
      >
        <AdminSidebarNav
          groups={[{ items: NAV }]}
          endMatchers={{ "/platform": true }}
          onNavigate={() => setMobileNavOpen(false)}
        />
      </MobileNavDrawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
            >
              <MenuIcon className="h-5 w-5" />
            </Button>
            <span className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground/70 sm:inline">
              Central traffic &amp; tenant management
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => dispatch(toggleTheme())}
              title="Toggle theme"
            >
              {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {(user?.name ?? user?.email ?? "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden max-w-[12rem] truncate sm:inline">
                    {user?.name ?? user?.email ?? "Account"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}>
                  <LogOut className="h-4 w-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
