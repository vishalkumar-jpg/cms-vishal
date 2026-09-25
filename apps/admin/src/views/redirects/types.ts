/**
 * Redirect shapes — mirror the API `redirects` table and DTOs.
 * Site-scoped via the X-Site-Id header (Axios mutator), so paths are relative.
 */
export interface Redirect {
  id: string;
  siteId: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  createdAt: string;
  updatedAt: string;
}

/** POST /redirects body */
export interface CreateRedirectPayload {
  fromPath: string;
  toPath: string;
  statusCode?: number;
}

/** PATCH /redirects/:id body */
export interface UpdateRedirectPayload {
  fromPath?: string;
  toPath?: string;
  statusCode?: number;
}

/** Allowed HTTP redirect status codes (301 default). */
export const REDIRECT_CODES = [301, 302, 307, 308] as const;
export type RedirectCode = (typeof REDIRECT_CODES)[number];

/** POST /redirects/import result (shape is best-effort). */
export interface ImportRedirectsResult {
  imported?: number;
}
