"use client";

import * as React from "react";
import {
  applyRootBlockStyles,
  SafeLink,
  sanitizeText,
  resolveSurfaceStyles,
  mergeVisualStyles,
  cssFromMini,
} from "../lib";
import { EditableText } from "../editable-text";
import { BlockEditingContext } from "../editable-text";
import { OB_NAV_ITEMS } from "../ob-nav-data";
import { NavBarProvider, useNavBar, type MobileNavRegistration, type NavMenuLink } from "../nav-context";
import { isNarrowViewport, useOBViewport } from "../viewport-context";
import { NavMegaPanel } from "./nav-blocks";

interface NavLink {
  label?: string;
  url?: string;
  items?: NavLink[];
  menuColumns?: Array<{ title?: string; url?: string; links?: NavLink[]; promo?: boolean }>;
}

const defaultLinks: NavLink[] = [
  { label: "Home", url: "/" },
  { label: "Services", url: "/services" },
  { label: "About", url: "/about" },
  { label: "Contact", url: "/contact" },
];

function hasNestedMenu(list: NavLink[]): boolean {
  return list.some((i) => (i.items?.length ?? 0) > 0 || (i.menuColumns?.length ?? 0) > 0);
}

/** Upgrade flat OB top-level links to the full dropdown/mega structure. */
function isFlatObNav(list: NavLink[]): boolean {
  return (
    list.length >= 5 &&
    list.some((i) => i.label === "Solutions") &&
    list.some((i) => i.label === "Staffing Services") &&
    !hasNestedMenu(list)
  );
}

function resolveNavItems(
  navItems: NavLink[],
  links: NavLink[],
  options?: { logoText?: string; logoUrl?: string; useObTemplate?: boolean; inBuilder?: boolean },
): NavLink[] {
  const obByLabel = new Map(OB_NAV_ITEMS.map((i) => [i.label, i]));

  const mergePartialObItems = (list: NavLink[]): NavLink[] =>
    list.map((item) => {
      const ob = obByLabel.get(item.label ?? "");
      if (!ob) return item;
      const hasNested = (item.items?.length ?? 0) > 0 || (item.menuColumns?.length ?? 0) > 0;
      if (!hasNested) {
        return {
          ...ob,
          ...item,
          items: ob.items,
          menuColumns: ob.menuColumns,
        };
      }
      if (item.label === "Staffing Services" && item.menuColumns?.length) {
        const hasPromo = item.menuColumns.some((c) => c.promo);
        if (!hasPromo && ob.menuColumns?.length) {
          return {
            ...item,
            menuColumns: [...item.menuColumns, ...(ob.menuColumns.filter((c) => c.promo) ?? [])],
          };
        }
      }
      return item;
    });

  if (options?.useObTemplate === true) return OB_NAV_ITEMS as NavLink[];

  if (navItems.length > 0) {
    if (hasNestedMenu(navItems)) return mergePartialObItems(navItems);
    if (isFlatObNav(navItems)) return OB_NAV_ITEMS as NavLink[];
    return mergePartialObItems(navItems);
  }
  if (links.length > 0) {
    if (hasNestedMenu(links)) return mergePartialObItems(links);
    if (isFlatObNav(links)) return OB_NAV_ITEMS as NavLink[];
    return mergePartialObItems(links);
  }

  const logoText = String(options?.logoText ?? "");
  const logoUrl = String(options?.logoUrl ?? "");
  const isObLogo =
    /office\s*beacon/i.test(logoText) || /officebeacon/i.test(logoUrl);

  if (isObLogo) return OB_NAV_ITEMS as NavLink[];
  if (options?.inBuilder) return defaultLinks;
  return OB_NAV_ITEMS as NavLink[];
}

function mobileChildren(item: NavLink): NavLink[] {
  if (item.items?.length) return item.items;
  if (item.menuColumns?.length) {
    return item.menuColumns.map((col) => ({
      label: col.title,
      url: col.url,
      items: col.links,
    }));
  }
  return [];
}

/** Editor-only empty-canvas placeholder from createCraftBlock — not real nav content. */
function isEditorDropPlaceholder(child: React.ReactNode): boolean {
  if (!React.isValidElement(child)) return false;
  const p = child.props as { children?: React.ReactNode; className?: string };
  return (
    p.children === "Drop blocks here" ||
    (typeof p.className === "string" && p.className.includes("ob-editor-canvas-placeholder"))
  );
}

function filterNavbarChildren(children: React.ReactNode): React.ReactNode[] {
  return React.Children.toArray(children).filter((c) => !isEditorDropPlaceholder(c));
}

/* ---- Topbar ------------------------------------------------------ */
export const Topbar = React.forwardRef<
  HTMLDivElement,
  {
    text?: string;
    linkUrl?: string;
    rightText?: string;
    rightUrl?: string;
    sticky?: boolean;
    styles?: unknown;
  }
>(({ text, linkUrl, rightText, rightUrl, styles, sticky = true }, ref) => {
  const inBuilder = React.useContext(BlockEditingContext) != null;
  const pinChrome = sticky !== false && !inBuilder;
  const alignEnd = Boolean(rightText && !text);
  const left = <EditableText as="span" propKey="text" value={text} />;
  return (
    <div
      ref={ref}
      className="ob-topbar"
      {...(pinChrome ? { "data-ob-sticky-topbar": "" as const } : {})}
      style={{
        ...applyRootBlockStyles(styles),
        ...(pinChrome ? { position: "sticky" as const, top: 0, zIndex: 501 } : {}),
      }}
    >
      <div
        className="ob-topbar-inner cms-fluid-container"
        style={{
          margin: "0 auto",
          width: "100%",
          display: "flex",
          justifyContent: alignEnd ? "flex-end" : "space-between",
          alignItems: "center",
          gap: 16,
          paddingTop: 10,
          paddingBottom: 10,
        }}
      >
        {text ? (
          <div style={{ flex: rightText ? undefined : 1 }}>
            {linkUrl && !rightText ? (
              <SafeLink url={linkUrl} style={{ color: "inherit", textDecoration: "none" }}>
                {left}
              </SafeLink>
            ) : (
              left
            )}
          </div>
        ) : null}
        {rightText ? (
          <div style={{ fontWeight: 600 }}>
            {linkUrl || rightUrl ? (
              <SafeLink url={rightUrl || linkUrl} style={{ color: "inherit", textDecoration: "none" }}>
                {sanitizeText(rightText)}
              </SafeLink>
            ) : (
              sanitizeText(rightText)
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
});
Topbar.displayName = "Topbar";

function mobileChildrenFromRegistration(item: MobileNavRegistration): NavMenuLink[] {
  if (item.items?.length) return item.items;
  if (item.menuColumns?.length) {
    return item.menuColumns.map((col) => ({
      label: col.title,
      url: col.url,
      items: col.links,
    }));
  }
  return [];
}

type MobileTreeLink = { label?: string; url?: string; items?: NavMenuLink[] };

/** Shared three-level mobile nav tree (composed + legacy navbar). */
const MobileNavMenuTreeItem: React.FC<{
  item: MobileTreeLink;
  itemKey: string;
  depth: number;
  childrenLinks: MobileTreeLink[];
  expandedMobile: Set<string>;
  onToggle: (key: string) => void;
  onNavigate: () => void;
}> = ({ item, itemKey, depth, childrenLinks, expandedMobile, onToggle, onNavigate }) => {
  const withMenu = childrenLinks.length > 0;
  const isExpanded = expandedMobile.has(itemKey);
  const depthClass = depth === 0 ? "parent" : depth === 1 ? "child" : "grandchild";

  if (!withMenu) {
    return (
      <li key={itemKey} className={`ob-mobile-menu__item mobile-menu__${depthClass}`}>
        <SafeLink
          url={item.url || "#"}
          className={`ob-mobile-menu__link mobile-menu__link mobile-menu__${depthClass}-link`}
          onClick={onNavigate}
        >
          {sanitizeText(item.label)}
        </SafeLink>
      </li>
    );
  }

  return (
    <li
      key={itemKey}
      className={`ob-mobile-menu__item mobile-menu__parent mobile-menu__parent--has-children${isExpanded ? " is-expanded" : ""}`}
    >
      <div className="ob-mobile-menu__row">
        {item.url ? (
          <SafeLink url={item.url} className="ob-mobile-menu__link mobile-menu__link mobile-menu__parent-link" onClick={onNavigate}>
            {sanitizeText(item.label)}
          </SafeLink>
        ) : (
          <span className="ob-mobile-menu__link mobile-menu__link mobile-menu__parent-link">{sanitizeText(item.label)}</span>
        )}
        <button
          type="button"
          className="ob-mobile-menu__sub-menu-toggler mobile-menu__sub-menu-toggler"
          aria-expanded={isExpanded}
          aria-label={`Show submenu for ${sanitizeText(item.label)}`}
          onClick={() => onToggle(itemKey)}
        >
          <span className="ob-mobile-menu__dropdown-icon mobile-menu__dropdown-icon" aria-hidden="true" />
        </button>
      </div>
      <ul className={`ob-mobile-menu__children mobile-menu__children${isExpanded ? " is-open" : ""}`}>
        {childrenLinks.map((child, ci) => {
          const childKey = `${itemKey}-${ci}`;
          const grandchildren = child.items || [];
          if (grandchildren.length > 0) {
            const childExpanded = expandedMobile.has(childKey);
            return (
              <li key={childKey} className={`mobile-menu__child mobile-menu__child--has-children${childExpanded ? " is-expanded" : ""}`}>
                <div className="ob-mobile-menu__row ob-mobile-menu__row--child">
                  <SafeLink url={child.url || "#"} className="ob-mobile-menu__link mobile-menu__link mobile-menu__child-link" onClick={onNavigate}>
                    {sanitizeText(child.label)}
                  </SafeLink>
                  <button
                    type="button"
                    className="ob-mobile-menu__sub-menu-toggler mobile-menu__sub-menu-toggler"
                    aria-expanded={childExpanded}
                    aria-label={`Show submenu for ${sanitizeText(child.label)}`}
                    onClick={() => onToggle(childKey)}
                  >
                    <span className="ob-mobile-menu__dropdown-icon mobile-menu__dropdown-icon" aria-hidden="true" />
                  </button>
                </div>
                <ul className={`ob-mobile-menu__grandchildren mobile-menu__grandchildren${childExpanded ? " is-open" : ""}`}>
                  {grandchildren.map((gc, gi) => (
                    <li key={gi} className="mobile-menu__grandchild">
                      <SafeLink url={gc.url || "#"} className="ob-mobile-menu__link mobile-menu__link mobile-menu__grandchild-link" onClick={onNavigate}>
                        {sanitizeText(gc.label)}
                      </SafeLink>
                    </li>
                  ))}
                </ul>
              </li>
            );
          }
          return (
            <li key={childKey} className="mobile-menu__child">
              <SafeLink url={child.url || "#"} className="ob-mobile-menu__link mobile-menu__link mobile-menu__child-link" onClick={onNavigate}>
                {sanitizeText(child.label)}
              </SafeLink>
            </li>
          );
        })}
      </ul>
    </li>
  );
};

/** Composed navbar shell — children are Image / Row / NavMenu / Button blocks. */
const NavbarComposed: React.FC<{
  children?: React.ReactNode;
  linkStyles?: Record<string, unknown>;
  showCta?: boolean;
  ctaText?: string;
  ctaUrl?: string;
  ctaStyle?: React.CSSProperties;
}> = ({ children, linkStyles = {}, showCta, ctaText, ctaUrl, ctaStyle }) => {
  const nav = useNavBar();
  const [expandedMobile, setExpandedMobile] = React.useState<Set<string>>(new Set());
  const navRootRef = React.useRef<HTMLDivElement | null>(null);
  const megaCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleMobileSection = (key: string) => {
    setExpandedMobile((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const scheduleCloseMega = (id: string) => {
    if (megaCloseTimer.current) clearTimeout(megaCloseTimer.current);
    megaCloseTimer.current = setTimeout(() => {
      if (nav?.activeMegaId === id) nav.setActiveMegaId(null);
    }, 150);
  };

  React.useEffect(() => () => {
    if (megaCloseTimer.current) clearTimeout(megaCloseTimer.current);
  }, []);

  React.useEffect(() => {
    const close = (e: MouseEvent) => {
      if (navRootRef.current && !navRootRef.current.contains(e.target as Node)) {
        nav?.setActiveMegaId(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [nav]);

  React.useEffect(() => {
    if (!nav?.menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") nav.setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [nav?.menuOpen, nav]);

  const renderMobileItem = (item: MobileNavRegistration, index: number, depth = 0) => {
    const key = `${depth}-${index}-${item.id}`;
    return (
      <MobileNavMenuTreeItem
        key={key}
        item={item}
        itemKey={key}
        depth={depth}
        childrenLinks={mobileChildrenFromRegistration(item)}
        expandedMobile={expandedMobile}
        onToggle={toggleMobileSection}
        onNavigate={() => nav?.closeMobile()}
      />
    );
  };

  const cta =
    showCta !== false ? (
      <SafeLink url={ctaUrl || "/contact"} style={ctaStyle} className="ob-btn ob-btn--primary cms-fluid-btn">
        {sanitizeText(ctaText) || "Get Started"}
      </SafeLink>
    ) : null;

  if (!nav) return null;

  return (
    <div ref={navRootRef} className="ob-nav-root">
      <div
        className="ob-nav-inner cms-fluid-container nav nav--contained"
        style={{
          margin: "0 auto",
          ["--ob-nav-link-gap" as string]: `${(linkStyles.gap as number) ?? 24}px`,
          ["--ob-nav-logo-height" as string]: "38px",
        }}
      >
        {children}
        <div className="navbar-desktop ob-nav-cta-bar nav__actions navbar-actions">{cta}</div>
        <button
          type="button"
          className="ob-nav__toggler burger-toggler"
          aria-controls={nav.drawerId}
          aria-expanded={nav.menuOpen}
          aria-label="Toggle main navigation"
          onClick={() => nav.setMenuOpen((open) => !open)}
        >
          <i aria-hidden="true" />
        </button>
      </div>
      {nav.megaPanels.map((mega) => (
        <NavMegaPanel
          key={mega.id}
          columns={mega.columns}
          isActive={nav.activeMegaId === mega.id}
          onEnter={() => nav.setActiveMegaId(mega.id)}
          onLeave={() => scheduleCloseMega(mega.id)}
        />
      ))}
      <div
        id={nav.drawerId}
        className={`ob-mobile-drawer nav__mobile mobile-drawer${nav.menuOpen ? " is-open" : ""}`}
        aria-hidden={!nav.menuOpen}
      >
        <ul className="ob-mobile-menu mobile-menu">
          {nav.mobileItems.map((item, i) => renderMobileItem(item, i))}
        </ul>
        {cta ? <div className="ob-mobile-menu__cta nav__mobile-ctas">{cta}</div> : null}
      </div>
    </div>
  );
};

/* ---- Navbar (SSR-safe; static markup, no Craft/router deps) ------ */
export const Navbar = React.forwardRef<HTMLElement, {
  mode?: "composed" | "legacy";
  logoText?: string;
  logoImage?: string;
  logoUrl?: string;
  logoImageHeight?: number;
  autoLinks?: boolean;
  useObTemplate?: boolean;
  navItems?: NavLink[];
  links?: NavLink[];
  linkStyles?: Record<string, unknown>;
  ctaText?: string;
  ctaUrl?: string;
  showCta?: boolean;
  ctaStyles?: Record<string, unknown>;
  navbarBg?: string;
  sticky?: boolean;
  transparent?: boolean;
  logoStyles?: Record<string, unknown>;
  styles?: unknown;
  children?: React.ReactNode;
}>(({
  mode,
  logoText,
  logoImage,
  logoUrl,
  logoImageHeight = 38,
  navItems = [],
  links = [],
  useObTemplate,
  linkStyles = {},
  ctaText,
  ctaUrl,
  showCta = true,
  ctaStyles = {},
  navbarBg,
  sticky,
  transparent,
  logoStyles = {},
  styles,
  children,
}, ref) => {
  const inBuilder = React.useContext(BlockEditingContext) != null;
  const viewport = useOBViewport();
  const narrow = isNarrowViewport(viewport);
  const { wrapper: blockLayout, surface: blockSurface } = resolveSurfaceStyles(styles);
  const bgColor = transparent
    ? "transparent"
    : navbarBg || (blockSurface.backgroundColor as string) || "#ffffff";
  const items = resolveNavItems(navItems, links, {
    logoText,
    logoUrl,
    useObTemplate,
    inBuilder,
  });

  const linkStyle: React.CSSProperties = {
    textDecoration: "none",
    color: (linkStyles.color as string) || "#7889a0",
    fontWeight: (linkStyles.fontWeight as React.CSSProperties["fontWeight"]) ?? 500,
    fontSize: linkStyles.fontSize ? `${linkStyles.fontSize}px` : "16px",
  };

  const ctaDefaults: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: `${(ctaStyles.paddingY as number) ?? 12}px ${(ctaStyles.paddingX as number) ?? 16}px`,
    background: (ctaStyles.background as string) || "linear-gradient(90deg, #147eff, #4d9dff)",
    color: (ctaStyles.color as string) || "#ffffff",
    borderRadius: (ctaStyles.borderRadius as number) ?? 6,
    fontWeight: (ctaStyles.fontWeight as React.CSSProperties["fontWeight"]) ?? 600,
    fontSize: 16,
    letterSpacing: "0.03em",
    boxShadow: "0 10px 20px -10px rgba(20, 126, 255, 0.35)",
    textDecoration: "none",
    whiteSpace: "nowrap",
    border: "none",
    lineHeight: 1,
  };
  const ctaStyle: React.CSSProperties = mergeVisualStyles(ctaDefaults, cssFromMini(ctaStyles));

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [activeMega, setActiveMega] = React.useState<number | null>(null);
  const [openDropdown, setOpenDropdown] = React.useState<number | null>(null);
  const [expandedMobile, setExpandedMobile] = React.useState<Set<string>>(new Set());
  const drawerId = React.useId();
  const megaCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRootRef = React.useRef<HTMLDivElement | null>(null);

  const header = (inner: React.ReactNode) => {
    const layout = { ...(blockLayout as React.CSSProperties) };
    delete layout.height;
    delete layout.maxHeight;
    if (narrow) {
      // Compact phone/tablet nav — let CSS own row height; inline 90px floor mis-centers logo + menu.
      if (layout.minHeight === 90 || layout.minHeight === "90px") {
        delete layout.minHeight;
      }
    } else if (typeof layout.minHeight !== "number" || layout.minHeight < 90) {
      layout.minHeight = 90;
    }
    if (sticky) {
      delete layout.position;
      delete layout.top;
    }
    return (
    <header
      ref={ref}
      className="cms-navbar site-header__nav"
      style={{
        zIndex: sticky && !inBuilder ? 500 : 200,
        width: "100%",
        backgroundColor: bgColor,
        borderBottom: transparent ? "none" : "1px solid #e2e8f0",
        overflow: "visible",
        ...layout,
        ...(sticky && !inBuilder ? { position: "sticky", top: 0 } : { position: "relative" }),
      }}
    >
      {inner}
    </header>
    );
  };

  const rawNavCount =
    (Array.isArray(navItems) ? navItems.length : 0) + (Array.isArray(links) ? links.length : 0);
  const composedChildren = filterNavbarChildren(children);
  const hasRealChildren = composedChildren.length > 0;

  // Legacy `navItems` / `links` drive the menu when no real composed blocks exist.
  // Editor "Drop blocks here" placeholders must not flip composed mode back on.
  const isComposed =
    mode === "legacy"
      ? false
      : rawNavCount > 0 && !hasRealChildren
        ? false
        : mode === "composed"
          ? hasRealChildren
          : hasRealChildren && rawNavCount === 0;

  const openMega = (index: number) => {
    if (megaCloseTimer.current) clearTimeout(megaCloseTimer.current);
    setActiveMega(index);
    setOpenDropdown(null);
  };

  const scheduleCloseMega = () => {
    if (megaCloseTimer.current) clearTimeout(megaCloseTimer.current);
    megaCloseTimer.current = setTimeout(() => setActiveMega(null), 150);
  };

  const openDropdownMenu = (index: number) => {
    if (dropdownCloseTimer.current) clearTimeout(dropdownCloseTimer.current);
    setOpenDropdown(index);
    setActiveMega(null);
  };

  const scheduleCloseDropdown = () => {
    if (dropdownCloseTimer.current) clearTimeout(dropdownCloseTimer.current);
    dropdownCloseTimer.current = setTimeout(() => setOpenDropdown(null), 150);
  };

  const toggleDropdown = (index: number) => {
    if (dropdownCloseTimer.current) clearTimeout(dropdownCloseTimer.current);
    setOpenDropdown((prev) => (prev === index ? null : index));
    setActiveMega(null);
  };

  React.useEffect(() => {
    const close = (e: MouseEvent) => {
      const root = navRootRef.current;
      if (root && !root.contains(e.target as Node)) {
        setOpenDropdown(null);
        setActiveMega(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  React.useEffect(() => () => {
    if (megaCloseTimer.current) clearTimeout(megaCloseTimer.current);
    if (dropdownCloseTimer.current) clearTimeout(dropdownCloseTimer.current);
  }, []);

  const toggleMobileSection = (key: string) => {
    setExpandedMobile((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const effectiveLogoHeight =
    typeof logoImageHeight === "number" && Number.isFinite(logoImageHeight)
      ? logoImageHeight
      : 38;

  const logo = (
    <SafeLink url={logoUrl || "/"} className="ob-nav__logo nav__logo" style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
      {logoImage ? (
        <img
          className="ob-nav__logo-img site-logo__image"
          src={String(logoImage)}
          alt={sanitizeText(logoText) || "Logo"}
          style={{
            objectFit: "contain",
            objectPosition: "left center",
            flexShrink: 0,
          }}
        />
      ) : (
        <span style={{ fontWeight: (logoStyles.fontWeight as number) ?? 700, fontSize: (logoStyles.fontSize as number) ?? 20, color: (logoStyles.color as string) || undefined }}>
          {sanitizeText(logoText) || "Brand"}
        </span>
      )}
    </SafeLink>
  );

  const renderDesktopItem = (item: NavLink, index: number) => {
    const isMega = Boolean(item.menuColumns?.length);
    const isDropdown = Boolean(item.items?.length) && !isMega;
    const withMenu = isMega || isDropdown;
    const isMegaActive = activeMega === index;
    const isDropdownOpen = openDropdown === index;

    if (!withMenu) {
      return (
        <li key={index} className="navbar-menu__parent ob-navbar-menu__parent">
          <SafeLink url={item.url || "#"} className="navbar-menu__link navbar-menu__parent-link ob-navbar-menu__link ob-navbar-menu__parent-link" style={linkStyle}>
            {sanitizeText(item.label)}
          </SafeLink>
        </li>
      );
    }

    return (
      <li
        key={index}
        className={`navbar-menu__parent navbar-menu__parent--has-children ob-navbar-menu__parent ob-navbar-menu__parent--has-children${isMegaActive ? " is-mega-active is-open" : ""}${isDropdownOpen ? " is-open" : ""}`}
        {...(isMega ? { "data-megamenu": ".megamenu--3" } : {})}
        onMouseEnter={() => {
          if (isMega) openMega(index);
          else if (isDropdown) openDropdownMenu(index);
        }}
        onMouseLeave={() => {
          if (isMega) scheduleCloseMega();
          else if (isDropdown) scheduleCloseDropdown();
        }}
      >
        {item.url && !withMenu ? (
          <SafeLink url={item.url} className="navbar-menu__link navbar-menu__parent-link ob-navbar-menu__link ob-navbar-menu__parent-link" style={linkStyle}>
            {sanitizeText(item.label)}
          </SafeLink>
        ) : item.url && withMenu ? (
          <SafeLink
            url={item.url}
            className="navbar-menu__link navbar-menu__parent-link ob-navbar-menu__link ob-navbar-menu__parent-link"
            style={linkStyle}
            onClick={(e) => {
              e.preventDefault();
              if (isMega) openMega(index);
              else toggleDropdown(index);
            }}
          >
            {sanitizeText(item.label)}
          </SafeLink>
        ) : (
          <span
            className="navbar-menu__link navbar-menu__parent-link ob-navbar-menu__link ob-navbar-menu__parent-link"
            style={{ ...linkStyle, cursor: "pointer" }}
            role="button"
            tabIndex={0}
            onClick={() => (isMega ? openMega(index) : toggleDropdown(index))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (isMega) openMega(index);
                else toggleDropdown(index);
              }
            }}
          >
            {sanitizeText(item.label)}
          </span>
        )}
        <button
          type="button"
          className="navbar-menu__sub-menu-toggler ob-navbar-menu__sub-menu-toggler"
          aria-expanded={isMegaActive || isDropdownOpen}
          aria-label={`Show submenu for ${sanitizeText(item.label)}`}
          {...(isMega ? { "data-megamenu": ".megamenu--3" } : {})}
          onClick={(e) => {
            e.stopPropagation();
            if (isMega) openMega(index);
            else toggleDropdown(index);
          }}
        >
          <span className="navbar-menu__dropdown-icon icon-dropdown ob-navbar-menu__dropdown-icon" aria-hidden="true" />
        </button>
        {isDropdown ? (
          <ul
            className={`navbar-menu__children ob-navbar-menu__children${isDropdownOpen ? " is-open" : ""}`}
            onMouseEnter={() => {
              if (dropdownCloseTimer.current) clearTimeout(dropdownCloseTimer.current);
            }}
            onMouseLeave={scheduleCloseDropdown}
          >
            {(item.items || []).map((sub, si) => (
              <li key={si} className="navbar-menu__child ob-navbar-menu__child">
                <SafeLink url={sub.url || "#"} className="navbar-menu__link navbar-menu__child-link ob-navbar-menu__link ob-navbar-menu__child-link">
                  {sanitizeText(sub.label)}
                </SafeLink>
              </li>
            ))}
          </ul>
        ) : null}
      </li>
    );
  };

  const renderMegaPanel = (item: NavLink, index: number) => {
    if (!item.menuColumns?.length) return null;
    return (
      <NavMegaPanel
        key={`mega-${index}`}
        columns={item.menuColumns}
        isActive={activeMega === index}
        onEnter={() => openMega(index)}
        onLeave={scheduleCloseMega}
      />
    );
  };

  const renderMobileItem = (item: NavLink, index: number, depth = 0) => {
    const key = `${depth}-${index}-${item.label}`;
    return (
      <MobileNavMenuTreeItem
        key={key}
        item={item}
        itemKey={key}
        depth={depth}
        childrenLinks={mobileChildren(item)}
        expandedMobile={expandedMobile}
        onToggle={toggleMobileSection}
        onNavigate={() => setMenuOpen(false)}
      />
    );
  };

  const cta =
    showCta !== false ? (
      <SafeLink url={ctaUrl || "/contact"} style={ctaStyle} className="ob-btn ob-btn--primary cms-fluid-btn">
        {sanitizeText(ctaText) || "Get Started"}
      </SafeLink>
    ) : null;

  if (isComposed) {
    return header(
      <NavBarProvider linkStyle={linkStyle}>
        <NavbarComposed
          linkStyles={linkStyles}
          showCta={showCta}
          ctaText={ctaText}
          ctaUrl={ctaUrl}
          ctaStyle={ctaStyle}
        >
          {composedChildren}
        </NavbarComposed>
      </NavBarProvider>,
    );
  }

  return header(
    <div ref={navRootRef} className="ob-nav-root" data-nav-mode="legacy">
      <div
        className="ob-nav-inner cms-fluid-container nav nav--contained"
        style={{
          margin: "0 auto",
          ["--ob-nav-link-gap" as string]: "0px",
          ["--ob-nav-logo-height" as string]: `${effectiveLogoHeight}px`,
          ["--ob-nav-logo-width" as string]: "175px",
          ["--ob-nav-height" as string]: "90px",
          ["--ob-nav-spacing-x" as string]: "1.375em",
        }}
      >
        {logo}
        <nav className="navbar-desktop ob-nav ob-nav--desktop-menu nav__menu-wrap nav__menu" aria-label="Main navigation">
          <ul className="navbar-menu nav__menu ob-navbar-menu">
            {items.map((item, i) => renderDesktopItem(item, i))}
          </ul>
        </nav>
        <div className="navbar-desktop ob-nav-cta-bar nav__actions navbar-actions">{cta}</div>
        <button
          type="button"
          className="ob-nav__toggler burger-toggler"
          aria-controls={drawerId}
          aria-expanded={menuOpen}
          aria-label="Toggle main navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <i aria-hidden="true" />
        </button>
      </div>
      {items.map((item, i) => renderMegaPanel(item, i))}
      <div
        id={drawerId}
        className={`ob-mobile-drawer nav__mobile mobile-drawer${menuOpen ? " is-open" : ""}`}
        aria-hidden={!menuOpen}
      >
        <ul className="ob-mobile-menu mobile-menu">
          {items.map((item, i) => renderMobileItem(item, i))}
        </ul>
        {cta ? <div className="ob-mobile-menu__cta nav__mobile-ctas">{cta}</div> : null}
      </div>
    </div>,
  );
});
Navbar.displayName = "Navbar";
