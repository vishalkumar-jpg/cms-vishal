import type { SerializedLayout, NodeMap } from "@ob-cms/block-schema";
import { craftToLayout, layoutToCraft } from "./serialize";

/**
 * Export / import helpers for the builder toolbar. Export uses Craft's native
 * `query.serialize()` node map; import accepts either that map or our wrapped
 * `SerializedLayout` and runs migrate + repair before `actions.deserialize()`.
 */

/** Sanitize a page title into a safe download filename stem. */
export const craftTreeFilename = (pageTitle: string): string => {
  const slug =
    pageTitle
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "page";
  return `${slug}-layout.json`;
};

/** Trigger a browser download of a JSON file. */
export const downloadJsonFile = (filename: string, json: string): void => {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

/** Pretty-print a Craft `query.serialize()` JSON string for export. */
export const formatCraftExport = (craftJson: string): string =>
  JSON.stringify(JSON.parse(craftJson) as unknown, null, 2);

const isNodeMap = (value: Record<string, unknown>): boolean =>
  Object.values(value).some(
    (entry) => entry != null && typeof entry === "object" && "type" in (entry as object),
  );

const isSerializedLayout = (value: Record<string, unknown>): boolean =>
  (typeof value.schemaVersion === "string" || typeof value.schemaVersion === "number") &&
  typeof value.root === "string" &&
  value.nodes != null &&
  typeof value.nodes === "object";

/**
 * Parse imported JSON (Craft node map or SerializedLayout), migrate + repair it,
 * and return a Craft-ready JSON string for `actions.deserialize()`.
 */
export const normalizeImportedCraftJson = (raw: string): string => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON — the file could not be parsed.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid layout — expected a JSON object.");
  }

  const obj = parsed as Record<string, unknown>;
  let craftNodes: NodeMap;

  if (isSerializedLayout(obj)) {
    craftNodes = layoutToCraft(obj as SerializedLayout);
  } else if (isNodeMap(obj)) {
    craftNodes = layoutToCraft(craftToLayout(JSON.stringify(obj)));
  } else {
    throw new Error(
      "Unrecognized layout format — expected a Craft.js node tree or SerializedLayout.",
    );
  }

  if (!craftNodes.ROOT) {
    throw new Error("Invalid layout — missing ROOT node.");
  }

  return JSON.stringify(craftNodes);
};
