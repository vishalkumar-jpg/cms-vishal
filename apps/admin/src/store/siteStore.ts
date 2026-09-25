import { create } from "zustand";
import { setActiveSiteIdResolver } from "@/services/AxiosService";

/**
 * Tenant/site context. The selected `siteId` is sent as the `X-Site-Id` header
 * on every API request (the resolver below is registered with the Axios
 * mutator). Persisted to localStorage so a refresh keeps the active site.
 */
const STORAGE_KEY = "ob-cms.activeSiteId";

interface SiteState {
  activeSiteId: string | null;
  setActiveSiteId: (siteId: string | null) => void;
}

const initialSiteId =
  typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;

export const useSiteStore = create<SiteState>((set) => ({
  activeSiteId: initialSiteId,
  setActiveSiteId: (siteId) => {
    if (typeof window !== "undefined") {
      if (siteId) window.localStorage.setItem(STORAGE_KEY, siteId);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
    set({ activeSiteId: siteId });
  },
}));

// Register the resolver so the Axios mutator can read the active site without a
// circular import.
setActiveSiteIdResolver(() => useSiteStore.getState().activeSiteId);
