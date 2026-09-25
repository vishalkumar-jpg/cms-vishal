import {
  isNonEmptyParamValue,
  isPlainObject,
  isValidHubSpotObjectTextContainer,
  isValidHubSpotSrcContainer,
  readHubSpotObjectTextField,
  readHubSpotSrcField,
  topLevelParamsOnlyAllowNonEmpty,
} from "../convert-module-params";
import { HUBSPOT_CARDS_PARAM_KEY } from "../complex-module-param-keys";

export { HUBSPOT_CARDS_PARAM_KEY };

export interface FeatureListCardProps {
  features: Array<{ title: string; icon?: string }>;
}

export const tryMapCardsParamsToFeatureListProps = (
  params: Record<string, unknown>,
): FeatureListCardProps | null => {
  if (!topLevelParamsOnlyAllowNonEmpty(params, [HUBSPOT_CARDS_PARAM_KEY])) {
    return null;
  }
  const cards = params[HUBSPOT_CARDS_PARAM_KEY];
  if (!Array.isArray(cards) || cards.length === 0) {
    return null;
  }

  const features: FeatureListCardProps["features"] = [];
  for (const item of cards) {
    if (!isPlainObject(item)) return null;
    for (const key of Object.keys(item)) {
      if (key !== "title" && key !== "image" && isNonEmptyParamValue(item[key])) {
        return null;
      }
    }
    if (!isValidHubSpotObjectTextContainer(item.title)) return null;
    const title = readHubSpotObjectTextField(item.title);
    if (!title) return null;

    if (item.image !== undefined && item.image !== null) {
      if (!isValidHubSpotSrcContainer(item.image)) return null;
    }

    const icon =
      item.image !== undefined && item.image !== null
        ? readHubSpotSrcField(item.image)
        : undefined;

    features.push(icon ? { title, icon } : { title });
  }

  return { features };
};
