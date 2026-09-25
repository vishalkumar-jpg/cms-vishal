import { sha256HexFromUtf8 } from "./sha256-hex";
import type { JsonValue } from "./types";

/** Hex chars taken from SHA-256(sourcePath) for collision-resistant stable node ids. */
const STABLE_NODE_ID_HEX_LENGTH = 16;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Deep clone into JSON-safe values (drops undefined, functions). */
export const toJsonValue = (value: unknown): JsonValue => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map((item) => toJsonValue(item));
  if (isPlainObject(value)) {
    const out: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      const v = value[key];
      if (v !== undefined) out[key] = toJsonValue(v);
    }
    return out;
  }
  return null;
};

/** Recursively sort object keys for deterministic serialization. */
export const sortJsonValueKeys = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) return value.map((item) => sortJsonValueKeys(item));
  if (value && typeof value === "object") {
    const obj = value as Record<string, JsonValue>;
    const sorted: Record<string, JsonValue> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortJsonValueKeys(obj[key]!);
    }
    return sorted;
  }
  return value;
};

const HTTP_URL_PATTERN = /^https?:\/\//i;
const SRCSET_DESCRIPTOR = /\s+(?:\d+[wx]|[\d.]+x)\s*(?:,|$)/i;
export const SRCSET_ATTRIBUTE_PATTERN =
  /((?:^|\s)srcset\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
const HTML_URL_ATTRIBUTE_PATTERN =
  /(?:^|\s)(src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;

const pushDiscoveredUrl = (
  url: string,
  discoveredAtPath: string,
  seen: Set<string>,
  out: { url: string; discoveredAtPath: string }[],
): void => {
  const trimmed = url.trim();
  if (!HTTP_URL_PATTERN.test(trimmed) || seen.has(trimmed)) return;
  seen.add(trimmed);
  out.push({ url: trimmed, discoveredAtPath });
};

/** Parse comma-separated srcset entries (url + optional width/density descriptor). */
export const extractHttpUrlsFromSrcset = (srcset: string): string[] => {
  const urls: string[] = [];
  for (const part of srcset.split(",")) {
    const token = part.trim().split(/\s+/)[0]?.trim();
    if (token && HTTP_URL_PATTERN.test(token)) urls.push(token);
  }
  return urls;
};

export const collectHttpUrlsFromJson = (
  value: JsonValue,
  path: string,
  seen: Set<string>,
  out: { url: string; discoveredAtPath: string }[],
): void => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (HTTP_URL_PATTERN.test(trimmed)) {
      pushDiscoveredUrl(trimmed, path, seen, out);
    }
    const attributeMatches = trimmed.matchAll(HTML_URL_ATTRIBUTE_PATTERN);
    for (const match of attributeMatches) {
      const attributeName = match[1]?.toLowerCase();
      const attributeValue = match[2] ?? match[3] ?? match[4] ?? "";
      pushDiscoveredUrl(attributeValue, `${path}@${attributeName}`, seen, out);
    }
    for (const match of trimmed.matchAll(SRCSET_ATTRIBUTE_PATTERN)) {
      const attributeValue = match[2] ?? match[3] ?? match[4] ?? "";
      for (const url of extractHttpUrlsFromSrcset(attributeValue)) {
        pushDiscoveredUrl(url, `${path}@srcset`, seen, out);
      }
    }
    if (SRCSET_DESCRIPTOR.test(trimmed) && trimmed.includes("http")) {
      for (const url of extractHttpUrlsFromSrcset(trimmed)) {
        pushDiscoveredUrl(url, `${path}@srcset`, seen, out);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectHttpUrlsFromJson(item, `${path}/${index}`, seen, out));
    return;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, JsonValue>;
    for (const key of Object.keys(obj).sort()) {
      collectHttpUrlsFromJson(obj[key]!, `${path}/${key}`, seen, out);
    }
  }
};

/** Stable id from a source path (deterministic SHA-256 prefix, not a security boundary). */
export const stableNodeIdFromPath = (sourcePath: string): string => {
  const hex = sha256HexFromUtf8(sourcePath);
  return `hsn_${hex.slice(0, STABLE_NODE_ID_HEX_LENGTH)}`;
};
