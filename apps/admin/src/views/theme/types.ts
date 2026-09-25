/**
 * Theme shapes — mirror the API `theme` table (ThemeRow) and the theme DTO.
 * Site-scoped via the X-Site-Id header (Axios mutator), so paths are relative.
 *
 * `tokens` and `brand` are free-form records on the API; the editor reads/writes
 * known keys (see TokenColors / TokenTypography / BrandFields) but never strips
 * unknown keys — extra keys round-trip via the raw-JSON advanced editor.
 */
export interface Theme {
  id: string;
  siteId: string;
  preset: string;
  tokens: Record<string, unknown>;
  brand: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** PATCH /theme — all fields optional; send only what changed. */
export interface UpdateThemePayload {
  preset?: string;
  tokens?: Record<string, unknown>;
  brand?: Record<string, unknown>;
}
