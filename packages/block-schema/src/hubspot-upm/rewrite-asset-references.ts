import type { SerializedLayout } from "../layout";
import { SRCSET_ATTRIBUTE_PATTERN } from "./json-utils";

/** Replace exact source URLs in a JSON tree (layout props, nested objects). */
export const rewriteAssetUrlsInJson = (
  value: unknown,
  urlMap: Readonly<Record<string, string>>,
): unknown => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return urlMap[value] ?? urlMap[trimmed] ?? value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteAssetUrlsInJson(item, urlMap));
  }
  if (value != null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = rewriteAssetUrlsInJson(child, urlMap);
    }
    return out;
  }
  return value;
};

export const rewriteAssetUrlsInSerializedLayout = (
  layout: SerializedLayout,
  urlMap: Readonly<Record<string, string>>,
): SerializedLayout => {
  if (!urlMap || Object.keys(urlMap).length === 0) return layout;
  const nodes: SerializedLayout["nodes"] = {};
  for (const [nodeId, node] of Object.entries(layout.nodes)) {
    nodes[nodeId] = {
      ...node,
      props: rewriteAssetUrlsInJson(node.props, urlMap) as typeof node.props,
    };
  }
  return { ...layout, nodes };
};

/**
 * Rewrite only `src` / `href` attribute values in HTML when they match a mapped URL.
 * Does not alter unrelated URLs or markup structure.
 */
export const rewriteSrcsetAttributeValue = (
  srcset: string,
  urlMap: Readonly<Record<string, string>>,
): string =>
  srcset
    .split(",")
    .map((candidate) => {
      const trimmed = candidate.trim();
      if (!trimmed) return trimmed;
      const separator = trimmed.search(/\s/);
      const rawUrl = separator === -1 ? trimmed : trimmed.slice(0, separator).trim();
      const descriptor = separator === -1 ? "" : trimmed.slice(separator);
      const mapped = urlMap[rawUrl] ?? rawUrl;
      return `${mapped}${descriptor}`;
    })
    .join(", ");

export const rewriteAssetUrlsInHtml = (
  html: string,
  urlMap: Readonly<Record<string, string>>,
): string => {
  if (!html || Object.keys(urlMap).length === 0) return html;
  const out = html.replace(
    SRCSET_ATTRIBUTE_PATTERN,
    (_match, prefix, doubleQuoted, singleQuoted, unquoted) => {
      const value = doubleQuoted ?? singleQuoted ?? unquoted ?? "";
      const rewritten = rewriteSrcsetAttributeValue(value, urlMap);
      if (doubleQuoted !== undefined) return `${prefix}"${rewritten}"`;
      if (singleQuoted !== undefined) return `${prefix}'${rewritten}'`;
      return `${prefix}${rewritten}`;
    },
  );
  return out.replace(
    /((?:^|\s)(?:src|href)\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi,
    (match, prefix, doubleQuoted, singleQuoted, unquoted) => {
      const value = doubleQuoted ?? singleQuoted ?? unquoted;
      const rewritten = urlMap[value];
      if (!rewritten || rewritten === value) return match;
      if (doubleQuoted !== undefined) return `${prefix}"${rewritten}"`;
      if (singleQuoted !== undefined) return `${prefix}'${rewritten}'`;
      return `${prefix}${rewritten}`;
    },
  );
};
