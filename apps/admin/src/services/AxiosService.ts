import Axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { SITE_ID_HEADER, API_PREFIX } from "@ob-cms/shared";

/**
 * Orval mutator. All SDK + wrapped-hook calls route through `request()`.
 *
 * - baseURL = `VITE_API_URL` (host only). SDK/Orval paths include the full
 *   versioned prefix (`/api/v1/...`); hand-written callers must do the same.
 * - Sends cookies (JWT cookie auth).
 * - Injects the active site as the `X-Site-Id` header (tenant context) via a
 *   resolver registered by the site store — keeps this module dependency-free.
 * - Echoes the CSRF double-submit cookie into `X-CSRF-Token` on mutations
 *   (WAVE4b). The API seeds a readable `ob_csrf` cookie on safe requests.
 * - Unwraps the ResponseDto envelope: returns `response.data.data` so hooks get
 *   the inner payload, not `{ data, status }`.
 */
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

const UNSAFE_METHODS = new Set(["post", "put", "patch", "delete"]);

/** Read a cookie value by name from document.cookie (browser only). */
function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

export const axiosInstance = Axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

/** Site-id resolver, registered by the site store (avoids a store import cycle). */
let activeSiteIdResolver: () => string | null = () => null;
export const setActiveSiteIdResolver = (resolver: () => string | null): void => {
  activeSiteIdResolver = resolver;
};

/** Optional global 401 handler (registered by the auth bootstrap). */
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: () => void): void => {
  onUnauthorized = handler;
};

axiosInstance.interceptors.request.use((config) => {
  const url = config.url ?? "";
  // Hand-written request() callers use bare paths (/auth/login); Orval SDK paths
  // already include API_PREFIX (/api/v1/...). Prepend once so both work with a
  // host-only baseURL.
  if (
    url.startsWith("/") &&
    url !== API_PREFIX &&
    !url.startsWith(`${API_PREFIX}/`) &&
    !url.startsWith(`${API_PREFIX}?`) &&
    !url.startsWith(`${API_PREFIX}#`)
  ) {
    config.url = `${API_PREFIX}${url}`;
  }
  const siteId = activeSiteIdResolver();
  if (siteId) {
    config.headers.set(SITE_ID_HEADER, siteId);
  }
  // CSRF double-submit: echo the readable ob_csrf cookie on state-changing calls.
  if (UNSAFE_METHODS.has((config.method ?? "get").toLowerCase())) {
    const csrf = readCookie("ob_csrf");
    if (csrf) config.headers.set("X-CSRF-Token", csrf);
  }
  return config;
});

/**
 * Refresh-on-401 (C21). The access cookie is short-lived (15m); when a request
 * 401s we transparently `POST /auth/refresh` ONCE to rotate the refresh cookie +
 * mint a fresh access cookie, then replay the original request — so the user is
 * never bounced to /login on a merely-expired access token.
 *
 * Concurrency: a single in-flight refresh is shared by all queued 401s
 * (`refreshPromise`), so a burst of parallel requests triggers exactly one
 * refresh. Loop prevention: the refresh call itself and login are never
 * refreshed, and each request is retried at most once (`_retried`).
 */
const REFRESH_URL = `${API_PREFIX}/auth/refresh`;
const NO_REFRESH = new Set([
  REFRESH_URL,
  `${API_PREFIX}/auth/login`,
  `${API_PREFIX}/auth/logout`,
]);

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

let refreshPromise: Promise<void> | null = null;

const runRefresh = async (): Promise<void> => {
  if (!refreshPromise) {
    refreshPromise = axiosInstance
      .post(REFRESH_URL)
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";

    const refreshable =
      status === 401 &&
      original &&
      !original._retried &&
      !NO_REFRESH.has(url);

    if (refreshable && original) {
      original._retried = true;
      try {
        await runRefresh();
        return await axiosInstance(original);
      } catch {
        // Refresh failed → the session is truly gone; fall through to logout.
        if (onUnauthorized) onUnauthorized();
        throw error;
      }
    }

    if (status === 401 && onUnauthorized && !NO_REFRESH.has(url)) {
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);

export const request = async <T>(config: AxiosRequestConfig): Promise<T> => {
  const promise = axiosInstance({ ...config }).then((response) => {
    const body = response.data;
    // Envelope unwrap: ResponseDto = { data, status }.
    if (body && typeof body === "object" && "data" in body && "status" in body) {
      return (body as { data: T }).data;
    }
    return body as T;
  });
  return promise;
};

export default request;
