import * as React from "react";
import { Outlet, useNavigate, Link } from "react-router";
import {
  LayoutDashboard,
  FileText,
  Activity,
  Users,
  Moon,
  Sun,
  LogOut,
  Image,
  Palette,
  Menu as MenuIcon,
  FormInput,
  ArrowRightLeft,
  Newspaper,
  Tag,
  Globe,
  PanelTop,
  Layers,
  Database,
  Loader2,
  ShieldCheck,
  KeyRound,
  ScrollText,
  PlugZap,
  Webhook,
  Search,
  BarChart3,
  Fingerprint,
  Users2,
  FlaskConical,
  DollarSign,
  Workflow,
  ShieldQuestion,
  Settings as SettingsIcon,
  CalendarDays,
  LayoutTemplate,
} from "lucide-react";
import { Button } from "@/components/ui";
import { CommandPalette } from "./CommandPalette";
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
import { useActiveSite } from "@/views/sites/hooks/useSites";
import { CreateSiteWizard } from "@/views/sites/components/CreateSiteWizard";
import { SiteSwitcher } from "./SiteSwitcher";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { TEMPLATE_LIBRARY_TITLE } from "@/views/template-library/constants";
import { NotificationBell } from "./NotificationBell";
import { AdminSidebarNav } from "./AdminSidebarNav";
import { MobileNavDrawer } from "./MobileNavDrawer";

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

/**
 * The single source of truth for the sidebar nav. Exported so the
 * CommandPalette can offer the same screens as "go to" navigation commands —
 * add a screen here and it appears in both the sidebar and ⌘K automatically.
 */
export const NAV_GROUPS: { heading?: string; items: NavItem[] }[] = [
  {
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    heading: "Content",
    items: [
      { to: "/pages", label: "Pages", icon: FileText },
      { to: "/blog", label: "Blog", icon: Newspaper },
      { to: "/calendar", label: "Calendar", icon: CalendarDays },
      { to: "/taxonomy", label: "Categories & Tags", icon: Tag },
      { to: "/media", label: "Media", icon: Image },
      { to: "/forms", label: "Forms", icon: FormInput },
      { to: "/template-library", label: TEMPLATE_LIBRARY_TITLE, icon: LayoutTemplate },
    ],
  },
  {
    heading: "Site",
    items: [
      { to: "/globals/header", label: "Header & Footer", icon: PanelTop },
      { to: "/reusable", label: "Reusable Blocks", icon: Layers },
      { to: "/collections", label: "Collections", icon: Database },
      { to: "/navigation", label: "Navigation", icon: MenuIcon },
      { to: "/theme", label: "Theme", icon: Palette },
      { to: "/redirects", label: "Redirects", icon: ArrowRightLeft },
      { to: "/developers", label: "API & Webhooks", icon: Webhook },
      { to: "/connectors", label: "Connectors", icon: PlugZap },
      { to: "/domains", label: "Domains", icon: Globe },
      { to: "/members", label: "Members", icon: Users },
      { to: "/roles", label: "Roles & Permissions", icon: KeyRound },
      { to: "/security", label: "Security", icon: ShieldCheck },
      { to: "/audit", label: "Audit log", icon: ScrollText },
      { to: "/privacy", label: "Data requests", icon: ShieldQuestion },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
  {
    heading: "Insights",
    items: [
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/identity", label: "Identity", icon: Fingerprint },
      { to: "/audiences", label: "Audiences", icon: Users2 },
      { to: "/experiments", label: "Experiments", icon: FlaskConical },
      { to: "/attribution", label: "Attribution", icon: DollarSign },
      { to: "/workflows", label: "Workflows", icon: Workflow },
      { to: "/monitoring", label: "Monitoring", icon: Activity },
    ],
  },
];

/**
 * First-run / no-site gate. The whole admin is website-scoped, so we never let a
 * user into the shell without an active site:
 *  - sites still loading → spinner.
 *  - user has ZERO sites → a mandatory "Create your first website" wizard.
 *  - otherwise (≥1 site) → `useActiveSite` auto-selects the first; render shell.
 */
const RequireSite: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { sites, activeSite, isLoading } = useActiveSite();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <Globe className="h-10 w-10 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Welcome to OB CMS</h1>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            You don&apos;t have any websites yet. Create your first website to start building.
          </p>
        </div>
        {/* mandatory wizard — cannot be dismissed until a site exists */}
        <CreateSiteWizard open mandatory onOpenChange={() => undefined} />
      </div>
    );
  }

  // ≥1 site but none resolved yet (auto-select effect still settling).
  if (!activeSite) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
};

/** Cohesive admin app shell: sidebar + topbar. Used for all authed routes
 *  except the full-screen builder. The whole shell is website-scoped. */
export const AppShell: React.FC = () => {
  const dispatch = useAppDispatch();
  const mode = useAppSelector((s) => s.theme.mode);
  const user = useAuthStore((s) => s.user);
  const logout = useAdminLogout();
  const navigate = useNavigate();
  const { activeSite } = useActiveSite();
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Global ⌘K / Ctrl+K toggles the command palette (Esc closes it via Radix).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onLogout = (): void => {
    logout.mutate();
    navigate("/login");
  };

  return (
    <RequireSite>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <div className="flex h-screen overflow-hidden bg-background">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
          <div className="flex h-14 items-center border-b border-border px-4">
            <Link to="/dashboard" className="text-lg font-bold tracking-tight hover:text-primary">
              OB<span className="text-primary">CMS</span>
            </Link>
          </div>
          <AdminSidebarNav groups={NAV_GROUPS} />
        </aside>

        <MobileNavDrawer
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          title={
            <Link to="/dashboard" className="text-lg font-bold tracking-tight hover:text-primary">
              OB<span className="text-primary">CMS</span>
            </Link>
          }
        >
          <AdminSidebarNav groups={NAV_GROUPS} onNavigate={() => setMobileNavOpen(false)} />
        </MobileNavDrawer>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 md:hidden"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation menu"
              >
                <MenuIcon className="h-5 w-5" />
              </Button>
              <span className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground/70 lg:inline">
                Website
              </span>
              <SiteSwitcher compact />
              <LocaleSwitcher />
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                title="Search (⌘K)"
                className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Search…</span>
                <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline">
                  ⌘K
                </kbd>
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => dispatch(toggleTheme())}
                title="Toggle theme"
              >
                {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <NotificationBell />
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
                  {activeSite && (
                    <p className="px-2 pb-1 text-[11px] text-muted-foreground">
                      Editing: {activeSite.name}
                    </p>
                  )}
                  <DropdownMenuSeparator />
                  {user?.isPlatformAdmin && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/platform">
                          <ShieldCheck className="h-4 w-4" /> Platform admin
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
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
    </RequireSite>
  );
};
