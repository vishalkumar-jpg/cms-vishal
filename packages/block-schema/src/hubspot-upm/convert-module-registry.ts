import type { NativeBlockPayload } from "../native-components";
import {
  COUNTER_SECTION_BLOCK,
  FEATURE_LIST_BLOCK,
  GALLERY_BLOCK,
  IMAGE_BLOCK,
  LOGO_CAROUSEL_BLOCK,
  STEP_CARDS_BLOCK,
  TABS_BLOCK,
} from "../resolved-block-names";
import {
  HUBSPOT_CARDS_PARAM_KEY,
  HUBSPOT_FEATURES_PARAM_KEY,
  HUBSPOT_GALLERY_PARAM_KEY,
  HUBSPOT_IMAGE_PARAM_KEY,
  HUBSPOT_IMG_PARAM_KEY,
  HUBSPOT_LOGOS_PARAM_KEY,
} from "./complex-module-param-keys";
import {
  isNonEmptyParamValue,
  moduleParamsIncludeCardsArray,
  readModuleParams,
} from "./convert-module-params";
import { tryMapCardsParamsToFeatureListProps } from "./converters/cards-to-feature-list";
import {
  HUBSPOT_COUNTERS_PARAM_KEY,
  moduleParamsIncludePikeCountersArray,
  tryMapPikeCountersParamsToCounterSectionProps,
} from "./converters/pike-counters-to-counter-section";
import {
  HUBSPOT_STEPS_PARAM_KEY,
  moduleParamsIncludeStepsArray,
  tryMapCustomStepsParamsToStepCardsProps,
} from "./converters/steps-to-step-cards";
import {
  HUBSPOT_STATS_PARAM_KEY,
  moduleParamsIncludeStatsArray,
  tryMapCustomStatsParamsToCounterSectionProps,
} from "./converters/stats-to-counter-section";
import {
  HUBSPOT_TABS_PARAM_KEY,
  moduleParamsIncludePikeTabsArray,
  tryMapPikeTabsParamsToTabsProps,
} from "./converters/tabs-to-tabs";
import {
  moduleParamsIncludePikeGallery,
  tryMapPikeGalleryParamsToGalleryProps,
} from "./converters/gallery-to-gallery";
import {
  moduleParamsIncludeLogoTouter,
  tryMapLogoTouterParamsToLogoCarouselProps,
} from "./converters/logos-to-logo-carousel";
import {
  moduleParamsIncludeLinkedImage,
  tryMapLinkedImageParamsToImageProps,
} from "./converters/linked-image-to-image";
import {
  moduleParamsIncludePikeImage,
  tryMapPikeImageParamsToImageProps,
} from "./converters/pike-image-to-image";
import type { HubspotSourceNode } from "./types";

export { HUBSPOT_FEATURES_PARAM_KEY };

const moduleParamsIncludeFeaturesArray = (params: Record<string, unknown>): boolean =>
  HUBSPOT_FEATURES_PARAM_KEY in params && Array.isArray(params[HUBSPOT_FEATURES_PARAM_KEY]);

const toGalleryNativeProps = (
  props: NonNullable<ReturnType<typeof tryMapPikeGalleryParamsToGalleryProps>>,
): Record<string, unknown> => ({
  images: props.images,
  ...(props.lightbox === true || props.lightbox === false ? { lightbox: props.lightbox } : {}),
});

const toLogoCarouselNativeProps = (
  props: NonNullable<ReturnType<typeof tryMapLogoTouterParamsToLogoCarouselProps>>,
): Record<string, unknown> => {
  const { logos, ...carouselFlags } = props;
  return { logos, ...carouselFlags };
};

/**
 * Phase F complex module conversion (shape-based). Returns:
 * - NativeBlockPayload when mapping succeeds
 * - null when signature matched but module must defer
 * - undefined when no complex signature applies (caller runs Phase E)
 */
export const tryConvertComplexHubspotModule = (
  node: HubspotSourceNode,
): NativeBlockPayload | null | undefined => {
  if (node.nodeKind !== "module") return undefined;

  const params = readModuleParams(node.payload);
  if (!params) return undefined;

  const hasModuleHtml = node.htmlFragments.some((f) => f.value.trim().length > 0);

  if (
    moduleParamsIncludeCardsArray(params) &&
    isNonEmptyParamValue(params[HUBSPOT_CARDS_PARAM_KEY])
  ) {
    if (hasModuleHtml) return null;
    const mapped = tryMapCardsParamsToFeatureListProps(params);
    return mapped
      ? { resolvedName: FEATURE_LIST_BLOCK, props: { features: mapped.features } }
      : null;
  }

  if (
    moduleParamsIncludeFeaturesArray(params) &&
    isNonEmptyParamValue(params[HUBSPOT_FEATURES_PARAM_KEY])
  ) {
    return null;
  }

  if (
    moduleParamsIncludePikeCountersArray(params) &&
    isNonEmptyParamValue(params[HUBSPOT_COUNTERS_PARAM_KEY])
  ) {
    if (hasModuleHtml) return null;
    const mapped = tryMapPikeCountersParamsToCounterSectionProps(params);
    return mapped
      ? { resolvedName: COUNTER_SECTION_BLOCK, props: { stats: mapped.stats } }
      : null;
  }

  if (
    moduleParamsIncludeStatsArray(params) &&
    isNonEmptyParamValue(params[HUBSPOT_STATS_PARAM_KEY])
  ) {
    if (hasModuleHtml) return null;
    const mapped = tryMapCustomStatsParamsToCounterSectionProps(params);
    return mapped
      ? { resolvedName: COUNTER_SECTION_BLOCK, props: { stats: mapped.stats } }
      : null;
  }

  if (
    moduleParamsIncludeStepsArray(params) &&
    isNonEmptyParamValue(params[HUBSPOT_STEPS_PARAM_KEY])
  ) {
    if (hasModuleHtml) return null;
    const mapped = tryMapCustomStepsParamsToStepCardsProps(params);
    return mapped
      ? { resolvedName: STEP_CARDS_BLOCK, props: { steps: mapped.steps } }
      : null;
  }

  if (
    moduleParamsIncludePikeTabsArray(params) &&
    isNonEmptyParamValue(params[HUBSPOT_TABS_PARAM_KEY])
  ) {
    if (hasModuleHtml) return null;
    const mapped = tryMapPikeTabsParamsToTabsProps(params);
    return mapped ? { resolvedName: TABS_BLOCK, props: { tabs: mapped.tabs } } : null;
  }

  if (
    moduleParamsIncludePikeGallery(params) &&
    isNonEmptyParamValue(params[HUBSPOT_GALLERY_PARAM_KEY])
  ) {
    if (hasModuleHtml) return null;
    const mapped = tryMapPikeGalleryParamsToGalleryProps(params);
    return mapped
      ? { resolvedName: GALLERY_BLOCK, props: toGalleryNativeProps(mapped) }
      : null;
  }

  if (
    moduleParamsIncludeLogoTouter(params) &&
    isNonEmptyParamValue(params[HUBSPOT_LOGOS_PARAM_KEY])
  ) {
    if (hasModuleHtml) return null;
    const mapped = tryMapLogoTouterParamsToLogoCarouselProps(params);
    return mapped
      ? { resolvedName: LOGO_CAROUSEL_BLOCK, props: toLogoCarouselNativeProps(mapped) }
      : null;
  }

  if (moduleParamsIncludeLinkedImage(params) && isNonEmptyParamValue(params[HUBSPOT_IMG_PARAM_KEY])) {
    if (hasModuleHtml) return null;
    const mapped = tryMapLinkedImageParamsToImageProps(params);
    return mapped ? { resolvedName: IMAGE_BLOCK, props: { ...mapped } } : null;
  }

  if (
    moduleParamsIncludePikeImage(params) &&
    isNonEmptyParamValue(params[HUBSPOT_IMAGE_PARAM_KEY])
  ) {
    if (hasModuleHtml) return null;
    const mapped = tryMapPikeImageParamsToImageProps(params);
    return mapped ? { resolvedName: IMAGE_BLOCK, props: { ...mapped } } : null;
  }

  return undefined;
};
