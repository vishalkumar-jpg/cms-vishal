import {
  COUNTER_SECTION_BLOCK,
  FEATURE_LIST_BLOCK,
  GALLERY_BLOCK,
  HEADING_BLOCK,
  IMAGE_BLOCK,
  LOGO_CAROUSEL_BLOCK,
  RICH_TEXT_BLOCK,
  STEP_CARDS_BLOCK,
  TABS_BLOCK,
} from "../resolved-block-names";
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

export interface HubspotNativeModuleEmitMetadata {
  conversionRole: string;
  nodeIdSuffix: string;
}

export const hubspotNativeModuleEmitMetadata = (
  resolvedName: string,
): HubspotNativeModuleEmitMetadata | undefined => {
  if (!Object.hasOwn(HUBSPOT_NATIVE_MODULE_EMIT_BY_BLOCK, resolvedName)) return undefined;
  return HUBSPOT_NATIVE_MODULE_EMIT_BY_BLOCK[resolvedName];
};

const HUBSPOT_NATIVE_MODULE_EMIT_BY_BLOCK: Record<string, HubspotNativeModuleEmitMetadata> = {
  [FEATURE_LIST_BLOCK]: {
    conversionRole: NATIVE_FEATURE_LIST,
    nodeIdSuffix: "native/feature_list",
  },
  [TABS_BLOCK]: {
    conversionRole: NATIVE_TABS,
    nodeIdSuffix: "native/tabs",
  },
  [COUNTER_SECTION_BLOCK]: {
    conversionRole: NATIVE_COUNTER_SECTION,
    nodeIdSuffix: "native/counter_section",
  },
  [STEP_CARDS_BLOCK]: {
    conversionRole: NATIVE_STEP_CARDS,
    nodeIdSuffix: "native/step_cards",
  },
  [IMAGE_BLOCK]: {
    conversionRole: NATIVE_IMAGE,
    nodeIdSuffix: "native/image",
  },
  [GALLERY_BLOCK]: {
    conversionRole: NATIVE_GALLERY,
    nodeIdSuffix: "native/gallery",
  },
  [LOGO_CAROUSEL_BLOCK]: {
    conversionRole: NATIVE_LOGO_CAROUSEL,
    nodeIdSuffix: "native/logo_carousel",
  },
  [RICH_TEXT_BLOCK]: {
    conversionRole: NATIVE_RICH_TEXT,
    nodeIdSuffix: "native/rich_text",
  },
  [HEADING_BLOCK]: {
    conversionRole: NATIVE_HEADING,
    nodeIdSuffix: "native/heading",
  },
};
