"use client";

import * as React from "react";

export interface NavMenuLink {
  label?: string;
  url?: string;
  items?: NavMenuLink[];
}

export interface NavMegaColumn {
  title?: string;
  url?: string;
  promo?: boolean;
  links?: NavMenuLink[];
}

export interface MobileNavRegistration {
  id: string;
  label?: string;
  url?: string;
  items?: NavMenuLink[];
  menuColumns?: NavMegaColumn[];
}

export interface MegaPanelRegistration {
  id: string;
  columns: NavMegaColumn[];
  index: number;
}

interface NavBarContextValue {
  drawerId: string;
  menuOpen: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeMegaId: string | null;
  setActiveMegaId: (id: string | null) => void;
  registerMobile: (entry: MobileNavRegistration) => void;
  unregisterMobile: (id: string) => void;
  mobileItems: MobileNavRegistration[];
  registerMega: (entry: MegaPanelRegistration) => void;
  unregisterMega: (id: string) => void;
  megaPanels: MegaPanelRegistration[];
  linkStyle: React.CSSProperties;
  closeMobile: () => void;
}

const NavBarContext = React.createContext<NavBarContextValue | null>(null);

export const useNavBar = (): NavBarContextValue | null => React.useContext(NavBarContext);

export const NavBarProvider: React.FC<{
  linkStyle?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ linkStyle = {}, children }) => {
  const drawerId = React.useId();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [activeMegaId, setActiveMegaId] = React.useState<string | null>(null);
  const [mobileMap, setMobileMap] = React.useState<Record<string, MobileNavRegistration>>({});
  const [megaMap, setMegaMap] = React.useState<Record<string, MegaPanelRegistration>>({});

  const registerMobile = React.useCallback((entry: MobileNavRegistration) => {
    setMobileMap((prev) => ({ ...prev, [entry.id]: entry }));
  }, []);

  const unregisterMobile = React.useCallback((id: string) => {
    setMobileMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const registerMega = React.useCallback((entry: MegaPanelRegistration) => {
    setMegaMap((prev) => ({ ...prev, [entry.id]: entry }));
  }, []);

  const unregisterMega = React.useCallback((id: string) => {
    setMegaMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveMegaId((cur) => (cur === id ? null : cur));
  }, []);

  const mobileItems = React.useMemo(
    () => Object.values(mobileMap).sort((a, b) => a.id.localeCompare(b.id)),
    [mobileMap],
  );

  const megaPanels = React.useMemo(
    () => Object.values(megaMap).sort((a, b) => a.index - b.index),
    [megaMap],
  );

  const value = React.useMemo(
    (): NavBarContextValue => ({
      drawerId,
      menuOpen,
      setMenuOpen,
      activeMegaId,
      setActiveMegaId,
      registerMobile,
      unregisterMobile,
      mobileItems,
      registerMega,
      unregisterMega,
      megaPanels,
      linkStyle,
      closeMobile: () => setMenuOpen(false),
    }),
    [
      drawerId,
      menuOpen,
      activeMegaId,
      registerMobile,
      unregisterMobile,
      mobileItems,
      registerMega,
      unregisterMega,
      megaPanels,
      linkStyle,
    ],
  );

  return <NavBarContext.Provider value={value}>{children}</NavBarContext.Provider>;
};
