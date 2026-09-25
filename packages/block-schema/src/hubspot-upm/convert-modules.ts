import type { BlockNode } from "../layout";
import {
  createNativeLeafBlock,
  validateNativeBlockPayload,
  type NativeBlockPayload,
} from "../native-components";
import {
  HEADING_BLOCK,
  RICH_TEXT_BLOCK,
} from "../resolved-block-names";
import { sanitizeHtml } from "../sanitize";
import { stableNodeIdFromPath } from "./json-utils";
import {
  isNonEmptyParamValue,
  isPlainObject,
  readModuleParams,
} from "./convert-module-params";
import {
  HUBSPOT_CAROUSEL_PARAM_KEY,
  HUBSPOT_GALLERY_PARAM_KEY,
  HUBSPOT_LOGOS_PARAM_KEY,
} from "./complex-module-param-keys";
import { tryConvertComplexHubspotModule } from "./convert-module-registry";
import {
  NATIVE_COUNTER_SECTION,
  NATIVE_FEATURE_LIST,
  NATIVE_GALLERY,
  NATIVE_HEADING,
  NATIVE_IMAGE,
  NATIVE_LOGO_CAROUSEL,
  NATIVE_RICH_TEXT,
  NATIVE_STEP_CARDS,
  NATIVE_TABS,
} from "./hubspot-conversion-roles";
import { buildHubspotNodeCustom } from "./hubspot-node-custom";
import { hubspotNativeModuleEmitMetadata } from "./hubspot-native-module-emit";
import type { HubspotExtractionDiagnostic, HubspotSourceNode, JsonValue } from "./types";

export {
  NATIVE_COUNTER_SECTION,
  NATIVE_FEATURE_LIST,
  NATIVE_GALLERY,
  NATIVE_HEADING,
  NATIVE_IMAGE,
  NATIVE_LOGO_CAROUSEL,
  NATIVE_RICH_TEXT,
  NATIVE_STEP_CARDS,
  NATIVE_TABS,
};

export const MODULE_CONVERTED_NATIVE = "MODULE_CONVERTED_NATIVE";

const UNSUPPORTED_MODULE_PARAM_KEYS = [
  "cards",
  "counters",
  "stats",
  "steps",
  "tabs",
  "features",
  "image",
  "images",
  "img",
  HUBSPOT_GALLERY_PARAM_KEY,
  HUBSPOT_LOGOS_PARAM_KEY,
  HUBSPOT_CAROUSEL_PARAM_KEY,
  "cta",
  "button",
  "buttons",
  "link",
  "links",
] as const;

export interface HubspotModuleConversionBlock {
  nodeId: string;
  node: BlockNode;
}

export interface HubspotModuleConversionResult {
  blocks: HubspotModuleConversionBlock[];
  diagnostics: HubspotExtractionDiagnostic[];
}

const htmlFromFragments = (node: HubspotSourceNode): string =>
  node.htmlFragments
    .map((f) => f.value)
    .filter(Boolean)
    .join("\n");

const readParams = (payload: JsonValue): Record<string, unknown> | undefined =>
  readModuleParams(payload);

/** Object-form heading is supported only when non-`text` properties are absent or empty. */
const isSupportedHeadingParam = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return true;
  if (!isPlainObject(value)) return false;
  for (const key of Object.keys(value)) {
    if (key === "text") {
      const text = value[key];
      if (text !== null && text !== undefined && typeof text !== "string") {
        return false;
      }
      continue;
    }
    if (isNonEmptyParamValue(value[key])) return false;
  }
  return true;
};

/** Non-empty params outside the Phase E allowlist prevent partial native conversion. */
export const moduleParamsBlockNativeConversion = (params: Record<string, unknown>): boolean => {
  for (const key of Object.keys(params)) {
    if (key === "heading") {
      if (!isSupportedHeadingParam(params[key])) return true;
      continue;
    }
    if ((UNSUPPORTED_MODULE_PARAM_KEYS as readonly string[]).includes(key)) {
      if (isNonEmptyParamValue(params[key])) return true;
      continue;
    }
    if (isNonEmptyParamValue(params[key])) return true;
  }
  return false;
};

const readGenericHeadingText = (params: Record<string, unknown>): string | undefined => {
  const heading = params.heading;
  if (typeof heading === "string" && heading.trim()) {
    return heading.trim();
  }
  if (isPlainObject(heading) && typeof heading.text === "string" && heading.text.trim()) {
    return heading.text.trim();
  }
  return undefined;
};

const convertedNativeDiagnostic = (
  node: HubspotSourceNode,
  blockType: string,
): HubspotExtractionDiagnostic => ({
  code: MODULE_CONVERTED_NATIVE,
  severity: "info",
  message: `HubSpot module converted to native ${blockType} block.`,
  path: node.sourcePath,
  hubspotType: node.hubspot?.moduleType,
});

const emitValidatedNativeBlock = (
  node: HubspotSourceNode,
  parentId: string,
  payload: NativeBlockPayload,
): HubspotModuleConversionBlock | null => {
  const validated = validateNativeBlockPayload(payload);
  if (!validated) return null;

  const emitMeta = hubspotNativeModuleEmitMetadata(validated.resolvedName);
  if (!emitMeta) return null;

  const nodeId = stableNodeIdFromPath(`${node.sourcePath}/${emitMeta.nodeIdSuffix}`);
  return {
    nodeId,
    node: createNativeLeafBlock({
      nodeId,
      parentId,
      payload: validated,
      custom: buildHubspotNodeCustom(node, emitMeta.conversionRole),
    }),
  };
};

const buildNativeModuleConversion = (
  node: HubspotSourceNode,
  parentId: string,
  payload: NativeBlockPayload,
): HubspotModuleConversionResult | null => {
  const block = emitValidatedNativeBlock(node, parentId, payload);
  if (!block) return null;
  return {
    blocks: [block],
    diagnostics: [convertedNativeDiagnostic(node, payload.resolvedName)],
  };
};

/**
 * Phase E + F: map a UPM module node to native OB block(s) when the entire module
 * shape is allowlisted. Returns null when any unsupported content remains
 * (deferred Group placeholder in Phase D).
 */
export const tryConvertHubspotModuleNode = (
  node: HubspotSourceNode,
  parentId: string,
): HubspotModuleConversionResult | null => {
  if (node.nodeKind !== "module") return null;

  const complex = tryConvertComplexHubspotModule(node);
  if (complex === null) return null;
  if (complex !== undefined) {
    return buildNativeModuleConversion(node, parentId, complex);
  }

  const params = readParams(node.payload);
  if (params && moduleParamsBlockNativeConversion(params)) {
    return null;
  }

  const html = sanitizeHtml(htmlFromFragments(node));
  const hasHtml = html.trim().length > 0;
  const headingText = params ? readGenericHeadingText(params) : undefined;

  if (!hasHtml && !headingText) return null;

  const blocks: HubspotModuleConversionBlock[] = [];
  const diagnostics: HubspotExtractionDiagnostic[] = [];

  if (hasHtml) {
    const block = emitValidatedNativeBlock(node, parentId, {
      resolvedName: RICH_TEXT_BLOCK,
      props: { html },
    });
    if (!block) return null;
    blocks.push(block);
    diagnostics.push(convertedNativeDiagnostic(node, RICH_TEXT_BLOCK));
  }

  if (headingText) {
    const block = emitValidatedNativeBlock(node, parentId, {
      resolvedName: HEADING_BLOCK,
      props: { text: headingText },
    });
    if (!block) return null;
    blocks.push(block);
    diagnostics.push(convertedNativeDiagnostic(node, HEADING_BLOCK));
  }

  return { blocks, diagnostics };
};
