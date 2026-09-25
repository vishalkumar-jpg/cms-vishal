import {
  HUBSPOT_CARDS_PARAM_KEY,
  HUBSPOT_COMPLEX_MODULE_ARRAY_PARAM_KEYS,
} from "./complex-module-param-keys";
import type { JsonValue } from "./types";

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const isNonEmptyParamValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return true;
};

const payloadHasModuleParamsShape = (payload: Record<string, unknown>): boolean => {
  if (typeof payload.module_id === "string" || typeof payload.module_id === "number") {
    return true;
  }
  if (typeof payload.path === "string" && payload.path.trim().length > 0) {
    return true;
  }
  return HUBSPOT_COMPLEX_MODULE_ARRAY_PARAM_KEYS.some((key) => key in payload);
};

/** Reads module params from either `{ params: {...} }` widget shells or flattened module payloads. */
export const readModuleParams = (payload: JsonValue): Record<string, unknown> | undefined => {
  if (!isPlainObject(payload)) return undefined;
  const nested = payload.params;
  if (isPlainObject(nested)) return nested;
  if (payloadHasModuleParamsShape(payload)) return payload;
  return undefined;
};

/**
 * HubSpot object text fields used by the cards corpus (`title: { text }` only).
 * Does not accept bare strings — that shape is limited to Phase E heading params.
 */
export const isValidHubSpotObjectTextContainer = (value: unknown): boolean => {
  if (!isPlainObject(value)) return false;
  for (const key of Object.keys(value)) {
    if (key === "text") {
      const text = value.text;
      if (text !== null && text !== undefined && typeof text !== "string") {
        return false;
      }
      continue;
    }
    if (isNonEmptyParamValue(value[key])) return false;
  }
  return true;
};

export const readHubSpotObjectTextField = (value: unknown): string | undefined => {
  if (!isValidHubSpotObjectTextContainer(value)) return undefined;
  if (!isPlainObject(value)) return undefined;
  const text = value.text;
  if (typeof text !== "string") return undefined;
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/** Corpus `image: { src }` — only `src` may be non-empty. */
export const isValidHubSpotSrcContainer = (value: unknown): boolean => {
  if (!isPlainObject(value)) return false;
  for (const key of Object.keys(value)) {
    if (key === "src") {
      const src = value.src;
      if (src !== null && src !== undefined && typeof src !== "string") {
        return false;
      }
      continue;
    }
    if (isNonEmptyParamValue(value[key])) return false;
  }
  return true;
};

export const readHubSpotSrcField = (value: unknown): string | undefined => {
  if (!isValidHubSpotSrcContainer(value)) return undefined;
  if (!isPlainObject(value)) return undefined;
  const src = value.src;
  if (typeof src !== "string") return undefined;
  const trimmed = src.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/** Every non-empty top-level param key must appear in `allowedNonEmptyKeys`. */
export const topLevelParamsOnlyAllowNonEmpty = (
  params: Record<string, unknown>,
  allowedNonEmptyKeys: readonly string[],
): boolean => {
  const allowed = new Set(allowedNonEmptyKeys);
  for (const key of Object.keys(params)) {
    if (!isNonEmptyParamValue(params[key])) continue;
    if (!allowed.has(key)) return false;
  }
  return true;
};

export const moduleParamsIncludeCardsArray = (params: Record<string, unknown>): boolean =>
  HUBSPOT_CARDS_PARAM_KEY in params && Array.isArray(params[HUBSPOT_CARDS_PARAM_KEY]);
