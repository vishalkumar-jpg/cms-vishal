import type { NavItem } from "@/lib/public-api-types";
import { SiteNavLinks } from "./site-nav-links";

export function SiteHeader({ items }: { items: NavItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <header
      className="w-full border-b"
      style={{
        background: "var(--color-header-bg, transparent)",
        borderColor: "var(--color-border, rgba(0,0,0,0.08))",
      }}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <SiteNavLinks items={items} />
      </nav>
    </header>
  );
}

export function SiteFooter({
  items,
  manageCookies = false,
}: {
  items: NavItem[];
  /**
   * PRIVACY & CONSENT — render a "Manage cookies" link that re-opens the consent
   * preference-center. The link is a plain server-rendered anchor carrying
   * `data-ob-cookie-settings`; the client <ConsentManager/> registers a delegated
   * click handler (lib/consent → registerConsentOpener) so no client component is
   * needed here and the footer stays a Server Component.
   */
  manageCookies?: boolean;
}) {
  const hasItems = !!items && items.length > 0;
  if (!hasItems && !manageCookies) return null;
  return (
    <footer
      className="w-full border-t"
      style={{
        background: "var(--color-footer-bg, transparent)",
        borderColor: "var(--color-border, rgba(0,0,0,0.08))",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-8">
        {hasItems ? <SiteNavLinks items={items} /> : <span />}
        {manageCookies ? (
          <a
            href="#"
            data-ob-cookie-settings=""
            className="text-sm font-medium hover:underline"
            style={{ color: "var(--color-nav-text, inherit)" }}
          >
            Manage cookies
          </a>
        ) : null}
      </div>
    </footer>
  );
}
