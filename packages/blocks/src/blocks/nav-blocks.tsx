"use client";

import * as React from "react";
import { SafeLink, sanitizeText, applyRootBlockStyles } from "../lib";
import { EditableText } from "../editable-text";
import { useNavBar, type NavMegaColumn, type NavMenuLink } from "../nav-context";

function megaColumnsToMobile(columns: NavMegaColumn[]): NavMenuLink[] {
  return columns
    .filter((c) => !c.promo)
    .map((col) => ({
      label: col.title,
      url: col.url,
      items: col.links,
    }));
}

/* ---- NavMenu (canvas — drop Nav Link / Dropdown / Mega items here) -------- */
export const NavMenu = React.forwardRef<
  HTMLUListElement,
  { styles?: unknown; children?: React.ReactNode }
>(({ styles, children }, ref) => {
  const { wrapper } = applyRootBlockStyles(styles) as { wrapper: React.CSSProperties };
  return (
    <nav className="navbar-desktop ob-nav ob-nav--desktop-menu nav__menu-wrap" aria-label="Main navigation" style={wrapper}>
      <ul ref={ref} className="navbar-menu nav__menu ob-navbar-menu">
        {children}
      </ul>
    </nav>
  );
});
NavMenu.displayName = "NavMenu";

/* ---- NavLinkItem — top-level simple link ---------------------------------- */
export const NavLinkItem = React.forwardRef<
  HTMLLIElement,
  { label?: string; url?: string; styles?: unknown }
>(({ label, url, styles }, ref) => {
  const nav = useNavBar();
  const id = React.useId();

  React.useLayoutEffect(() => {
    if (!nav) return;
    nav.registerMobile({ id, label, url });
    return () => nav.unregisterMobile(id);
  }, [nav, id, label, url]);

  const { wrapper } = applyRootBlockStyles(styles) as { wrapper: React.CSSProperties };
  const linkStyle = nav?.linkStyle ?? {};

  return (
    <li ref={ref} className="navbar-menu__parent ob-navbar-menu__parent" style={wrapper}>
      <SafeLink
        url={url || "#"}
        className="navbar-menu__link navbar-menu__parent-link ob-navbar-menu__link ob-navbar-menu__parent-link"
        style={linkStyle}
      >
        <EditableText as="span" propKey="label" value={label} />
      </SafeLink>
    </li>
  );
});
NavLinkItem.displayName = "NavLinkItem";

/* ---- NavDropdown — hover / click dropdown --------------------------------- */
const EMPTY_ITEMS: NavMenuLink[] = [];

export const NavDropdown = React.forwardRef<
  HTMLLIElement,
  { label?: string; url?: string; items?: NavMenuLink[]; styles?: unknown }
>(({ label, url, items = EMPTY_ITEMS, styles }, ref) => {
  const nav = useNavBar();
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const isOpen = open;

  React.useLayoutEffect(() => {
    if (!nav) return;
    nav.registerMobile({ id, label, url, items });
    return () => nav.unregisterMobile(id);
  }, [nav, id, label, url, items]);

  const { wrapper } = applyRootBlockStyles(styles) as { wrapper: React.CSSProperties };
  const linkStyle = nav?.linkStyle ?? {};

  return (
    <li
      ref={ref}
      className={`navbar-menu__parent navbar-menu__parent--has-children ob-navbar-menu__parent ob-navbar-menu__parent--has-children${isOpen ? " is-open" : ""}`}
      style={wrapper}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {url ? (
        <SafeLink
          url={url}
          className="navbar-menu__link navbar-menu__parent-link ob-navbar-menu__link ob-navbar-menu__parent-link"
          style={linkStyle}
          onClick={(e) => {
            e.preventDefault();
            setOpen((v) => !v);
          }}
        >
          <EditableText as="span" propKey="label" value={label} />
        </SafeLink>
      ) : (
        <span
          className="navbar-menu__link navbar-menu__parent-link ob-navbar-menu__link ob-navbar-menu__parent-link"
          style={{ ...linkStyle, cursor: "pointer" }}
          role="button"
          tabIndex={0}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((v) => !v);
            }
          }}
        >
          <EditableText as="span" propKey="label" value={label} />
        </span>
      )}
      <button
        type="button"
        className="navbar-menu__sub-menu-toggler ob-navbar-menu__sub-menu-toggler"
        aria-expanded={isOpen}
        aria-label={`Show submenu for ${sanitizeText(label)}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className="navbar-menu__dropdown-icon icon-dropdown ob-navbar-menu__dropdown-icon" aria-hidden="true" />
      </button>
      <ul className={`navbar-menu__children ob-navbar-menu__children${isOpen ? " is-open" : ""}`}>
        {items.map((sub, si) => (
          <li key={si} className="navbar-menu__child ob-navbar-menu__child">
            <SafeLink url={sub.url || "#"} className="navbar-menu__link navbar-menu__child-link ob-navbar-menu__link ob-navbar-menu__child-link">
              {sanitizeText(sub.label)}
            </SafeLink>
          </li>
        ))}
      </ul>
    </li>
  );
});
NavDropdown.displayName = "NavDropdown";

/* ---- NavMega — full-width mega menu panel --------------------------------- */
const EMPTY_COLUMNS: NavMegaColumn[] = [];

export const NavMega = React.forwardRef<
  HTMLLIElement,
  { label?: string; columns?: NavMegaColumn[]; styles?: unknown; megaIndex?: number }
>(({ label, columns = EMPTY_COLUMNS, styles, megaIndex = 0 }, ref) => {
  const nav = useNavBar();
  const id = React.useId();
  const isActive = nav?.activeMegaId === id;

  const open = () => nav?.setActiveMegaId(id);
  const close = () => {
    if (nav?.activeMegaId === id) nav.setActiveMegaId(null);
  };

  const columnsKey = React.useMemo(() => JSON.stringify(columns), [columns]);

  React.useLayoutEffect(() => {
    if (!nav) return;
    nav.registerMobile({
      id,
      label,
      menuColumns: columns,
      items: megaColumnsToMobile(columns),
    });
    return () => nav.unregisterMobile(id);
  }, [nav, id, label, columnsKey]);

  React.useLayoutEffect(() => {
    if (!nav) return;
    nav.registerMega({ id, columns, index: megaIndex });
    return () => nav.unregisterMega(id);
  }, [nav, id, columnsKey, megaIndex]);

  const linkStyle = nav?.linkStyle ?? {};
  const { wrapper } = applyRootBlockStyles(styles) as { wrapper: React.CSSProperties };

  return (
    <li
      ref={ref}
      className={`navbar-menu__parent navbar-menu__parent--has-children ob-navbar-menu__parent ob-navbar-menu__parent--has-children${isActive ? " is-mega-active is-open" : ""}`}
      data-megamenu=".megamenu--3"
      style={wrapper}
      onMouseEnter={open}
      onMouseLeave={close}
    >
      <span
        className="navbar-menu__link navbar-menu__parent-link ob-navbar-menu__link ob-navbar-menu__parent-link"
        style={{ ...linkStyle, cursor: "pointer" }}
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
      >
        <EditableText as="span" propKey="label" value={label} />
      </span>
      <button
        type="button"
        className="navbar-menu__sub-menu-toggler ob-navbar-menu__sub-menu-toggler"
        aria-expanded={isActive}
        aria-label={`Show submenu for ${sanitizeText(label)}`}
        data-megamenu=".megamenu--3"
        onClick={(e) => {
          e.stopPropagation();
          if (isActive) close();
          else open();
        }}
      >
        <span className="navbar-menu__dropdown-icon icon-dropdown ob-navbar-menu__dropdown-icon" aria-hidden="true" />
      </button>
    </li>
  );
});
NavMega.displayName = "NavMega";

/** Renders a mega panel from column data (used by Navbar host). */
export const NavMegaPanel: React.FC<{
  columns: NavMegaColumn[];
  isActive: boolean;
  onEnter: () => void;
  onLeave: () => void;
}> = ({ columns, isActive, onEnter, onLeave }) => (
  <div
    className={`container-fluid megamenu megamenu--3 ob-nav-mega-panel${isActive ? " megamenu--active is-active" : ""}`}
    onMouseEnter={onEnter}
    onMouseLeave={onLeave}
    aria-hidden={!isActive}
  >
    <div className="ob-nav-mega-panel__inner cms-fluid-container megamenu_3-row-0-padding">
      <div className="ob-nav-mega-panel__grid megamenu__grid">
        {columns.map((col, ci) => (
          <div key={ci} className={`ob-nav-mega-panel__col dnd-column${col.promo ? " ob-nav-mega-panel__col--promo" : ""}`}>
            {col.promo ? (
              <p className="ob-nav-mega-promo">
                {col.url ? (
                  <SafeLink url={col.url} className="ob-nav-mega-promo-link">
                    {sanitizeText(col.title)} <strong>&gt;</strong>
                  </SafeLink>
                ) : (
                  <span className="ob-nav-mega-promo-link">
                    {sanitizeText(col.title)} <strong>&gt;</strong>
                  </span>
                )}
              </p>
            ) : (
              <>
                {col.title ? (
                  <p className="ob-nav-mega-title-wrap">
                    {col.url ? (
                      <SafeLink url={col.url} className="ob-nav-mega-title ob-nav-mega-title--link">
                        {sanitizeText(col.title)}
                      </SafeLink>
                    ) : (
                      <span className="ob-nav-mega-title">{sanitizeText(col.title)}</span>
                    )}
                  </p>
                ) : null}
                <ul className="ob-nav-mega-links hs-menu-wrapper">
                  {(col.links || []).map((sub, si) => (
                    <li key={si} className="hs-menu-item">
                      <SafeLink url={sub.url || "#"} className="ob-nav-dropdown-link">
                        {sanitizeText(sub.label)}
                      </SafeLink>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);
