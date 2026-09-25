import {
  CURRENT_SCHEMA_VERSION,
  serializedLayoutSchema,
  type PageSeo,
  type SerializedLayout,
} from "./layout";
import { migrate } from "./migrate";
import { sanitizeText, sanitizeUrl } from "./sanitize";

/**
 * Importer / migrator for the Craft.js POC export format (v2.0):
 *   { metadata: { title, description, canonicalUrl, ogImage, version, ... },
 *     craft: "<JSON.stringify of the node map>" }
 *
 * `importPocExport(json)` → { seo, layout } — parses metadata→seo, JSON.parses
 * the craft string, validates + repairs the node map, and stamps the current
 * schemaVersion. `serializeLayout(layout)` produces a stable string for
 * round-trips.
 */

export interface PocExport {
  metadata?: {
    title?: string;
    description?: string;
    canonicalUrl?: string;
    canonical?: string;
    ogImage?: string;
    version?: string;
    [k: string]: unknown;
  };
  craft?: string | Record<string, unknown>;
}

export interface ImportResult {
  seo: PageSeo;
  layout: SerializedLayout;
}

const parseSeo = (metadata: PocExport["metadata"] = {}): PageSeo => ({
  title: sanitizeText(metadata.title ?? ""),
  description: sanitizeText(metadata.description ?? ""),
  canonical: sanitizeUrl(metadata.canonicalUrl ?? metadata.canonical ?? ""),
  ogImage: sanitizeUrl(metadata.ogImage ?? ""),
});

/** Parse + validate + repair a POC export into { seo, layout }. */
export const importPocExport = (json: unknown): ImportResult => {
  const exportObj: PocExport =
    typeof json === "string" ? (JSON.parse(json) as PocExport) : (json as PocExport);

  if (!exportObj || typeof exportObj !== "object") {
    throw new Error("importPocExport: invalid export — expected an object");
  }

  const seo = parseSeo(exportObj.metadata);

  // craft is a stringified node map (query.serialize()).
  let rawNodes: unknown;
  const craft = exportObj.craft;
  if (typeof craft === "string") {
    try {
      rawNodes = JSON.parse(craft);
    } catch (err) {
      throw new Error(`importPocExport: craft is not valid JSON — ${(err as Error).message}`);
    }
  } else if (craft && typeof craft === "object") {
    rawNodes = craft;
  } else {
    throw new Error("importPocExport: missing craft node map");
  }

  if (!rawNodes || typeof rawNodes !== "object") {
    throw new Error("importPocExport: craft did not deserialize to a node map");
  }

  const fromVersion = exportObj.metadata?.version ?? CURRENT_SCHEMA_VERSION;

  const layout = migrate(
    { schemaVersion: fromVersion, root: "ROOT", nodes: rawNodes },
    fromVersion,
  );

  return { seo, layout };
};

/**
 * Serialize a layout to a stable JSON string for persistence / round-trip.
 * Node-map keys are sorted for deterministic output.
 */
export const serializeLayout = (layout: SerializedLayout): string => {
  const parsed = serializedLayoutSchema.parse(layout);
  const sortedNodes: Record<string, unknown> = {};
  for (const key of Object.keys(parsed.nodes).sort()) {
    sortedNodes[key] = parsed.nodes[key];
  }
  return JSON.stringify({
    schemaVersion: parsed.schemaVersion,
    root: parsed.root,
    nodes: sortedNodes,
  });
};

/** Parse a serialized layout string back into a validated, repaired layout. */
export const deserializeLayout = (input: string): SerializedLayout =>
  migrate(JSON.parse(input));
