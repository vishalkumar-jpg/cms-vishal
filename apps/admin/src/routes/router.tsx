import { createBrowserRouter, Navigate } from "react-router";
import { Login } from "@/views/login/Login";
import { AcceptInvite } from "@/views/invitations/AcceptInvite";
import { AuditLog } from "@/views/audit/AuditLog";
import { Dashboard } from "@/views/dashboard/Dashboard";
import { Pages } from "@/views/pages/Pages";
import { Members } from "@/views/members/Members";
import { Roles } from "@/views/roles/Roles";
import { Preview } from "@/views/builder/Preview";
import { GlobalsBuilder } from "@/views/globals/GlobalsBuilder";
import { ReusableBlocks } from "@/views/reusable-blocks/ReusableBlocks";
import { ReusableBlockEditor } from "@/views/reusable-blocks/ReusableBlockEditor";
import { MediaLibrary } from "@/views/media/MediaLibrary";
import { ThemeEditor } from "@/views/theme/ThemeEditor";
import { NavigationEditor } from "@/views/navigation/NavigationEditor";
import { Forms } from "@/views/forms/Forms";
import { TemplateLibraryPage } from "@/views/template-library/TemplateLibraryPage";
import { TemplateStarterDetailPage } from "@/views/template-library/TemplateStarterDetailPage";
import { Collections } from "@/views/collections/Collections";
import { CollectionEditor } from "@/views/collections/CollectionEditor";
import { CollectionDetailBuilder } from "@/views/collections/CollectionDetailBuilder";
import { Redirects } from "@/views/redirects/Redirects";
import { Developers } from "@/views/developers/Developers";
import { StyleVerificationPage } from "@/views/developers/StyleVerificationPage";
import { Connectors } from "@/views/connectors/Connectors";
import { Domains } from "@/views/domains/Domains";
import { Security } from "@/views/security/Security";
import { Blog } from "@/views/blog/Blog";
import { Settings } from "@/views/settings/Settings";
import { Privacy } from "@/views/privacy/Privacy";
import { Taxonomy } from "@/views/blog/Taxonomy";
import { PostBuilder } from "@/views/blog/PostBuilder";
import { PostPreview } from "@/views/blog/PostPreview";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { PlatformShell } from "@/components/layout/PlatformShell";
import { PlatformDashboard } from "@/views/platform/PlatformDashboard";
import { PlatformSites } from "@/views/platform/PlatformSites";
import { PlatformBackups } from "@/views/platform/PlatformBackups";
import { Monitoring } from "@/views/monitoring/Monitoring";
import { Notifications } from "@/views/notifications/Notifications";
import { Analytics } from "@/views/analytics/Analytics";
import { Identity } from "@/views/identity/Identity";
import { Audiences } from "@/views/audiences/Audiences";
import { Experiments } from "@/views/experiments/Experiments";
import { Attribution } from "@/views/attribution/Attribution";
import { Workflows } from "@/views/workflows/Workflows";
import { Calendar } from "@/views/calendar/Calendar";
import { Builder } from "@/views/builder/Builder";

/**
 * App routes.
 *  - /login — public.
 *  - ProtectedRoute bootstraps the session and guards everything below.
 *    - AppShell (sidebar + topbar): all management screens.
 *    - /pages/:pageId/builder — full-screen Craft.js builder (no shell).
 */
export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  // Public invite-acceptance page (token in ?token=). OUTSIDE ProtectedRoute.
  { path: "/accept-invite", element: <AcceptInvite /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <Navigate to="/dashboard" replace /> },
          { path: "/dashboard", element: <Dashboard /> },
          { path: "/pages", element: <Pages /> },
          { path: "/blog", element: <Blog /> },
          { path: "/calendar", element: <Calendar /> },
          { path: "/taxonomy", element: <Taxonomy /> },
          { path: "/media", element: <MediaLibrary /> },
          { path: "/forms", element: <Forms /> },
          { path: "/template-library", element: <TemplateLibraryPage /> },
          { path: "/template-library/starter/:id", element: <TemplateStarterDetailPage /> },
          {
            path: "/template-catalog",
            element: <Navigate to="/template-library?tab=starter" replace />,
          },
          { path: "/navigation", element: <NavigationEditor /> },
          { path: "/theme", element: <ThemeEditor /> },
          { path: "/redirects", element: <Redirects /> },
          { path: "/developers", element: <Developers /> },
          { path: "/developers/style-verification", element: <StyleVerificationPage /> },
          { path: "/connectors", element: <Connectors /> },
          { path: "/import", element: <Navigate to="/connectors" replace /> },
          { path: "/domains", element: <Domains /> },
          { path: "/reusable", element: <ReusableBlocks /> },
          { path: "/collections", element: <Collections /> },
          { path: "/collections/:id", element: <CollectionEditor /> },
          { path: "/members", element: <Members /> },
          { path: "/roles", element: <Roles /> },
          { path: "/security", element: <Security /> },
          { path: "/audit", element: <AuditLog /> },
          { path: "/monitoring", element: <Monitoring /> },
          { path: "/notifications", element: <Notifications /> },
          { path: "/analytics", element: <Analytics /> },
          { path: "/identity", element: <Identity /> },
          { path: "/audiences", element: <Audiences /> },
          { path: "/experiments", element: <Experiments /> },
          { path: "/attribution", element: <Attribution /> },
          { path: "/workflows", element: <Workflows /> },
          { path: "/settings", element: <Settings /> },
          { path: "/privacy", element: <Privacy /> },
        ],
      },
      // Platform-admin console (cross-tenant). Own light shell, no SiteSwitcher;
      // PlatformShell bounces non-platform-admins to /dashboard.
      {
        element: <PlatformShell />,
        children: [
          { path: "/platform", element: <PlatformDashboard /> },
          { path: "/platform/sites", element: <PlatformSites /> },
          { path: "/platform/backups", element: <PlatformBackups /> },
        ],
      },
      { path: "/pages/:pageId/builder", element: <Builder /> },
      { path: "/pages/:pageId/preview", element: <Preview /> },
      // Visual blog-post builder + draft preview (full-screen, no shell).
      { path: "/blog/:postId/builder", element: <PostBuilder /> },
      { path: "/blog/:postId/preview", element: <PostPreview /> },
      // GLOBAL-CHROME — full-screen builder for the site's global header/footer.
      { path: "/globals/:slot", element: <GlobalsBuilder /> },
      // REUSE-BLOCKS — full-screen builder for a reusable block's source layout.
      { path: "/reusable/:id", element: <ReusableBlockEditor /> },
      // Collection detail layout builder (save-is-live; no AppShell).
      { path: "/collections/:id/detail-builder", element: <CollectionDetailBuilder /> },
    ],
  },
  { path: "*", element: <Navigate to="/login" replace /> },
]);
