import {
  isNonEmptyParamValue,
  isPlainObject,
  topLevelParamsOnlyAllowNonEmpty,
} from "../convert-module-params";
import { HUBSPOT_STATS_PARAM_KEY } from "../complex-module-param-keys";

export { HUBSPOT_STATS_PARAM_KEY };

export const CUSTOM_STATS_ALLOWED_TOP_LEVEL_KEYS = [
  "css_class",
  "module_id",
  "schema_version",
  HUBSPOT_STATS_PARAM_KEY,
] as const;

export interface CustomStatsCounterSectionProps {
  stats: Array<{ value: string; label: string; description: string }>;
}

const mapStatItem = (item: unknown): CustomStatsCounterSectionProps["stats"][number] | null => {
  if (!isPlainObject(item)) return null;
  for (const key of Object.keys(item)) {
    if (
      key !== "stat_number" &&
      key !== "stat_label" &&
      key !== "stat_description" &&
      isNonEmptyParamValue(item[key])
    ) {
      return null;
    }
  }
  if (typeof item.stat_number !== "string" || !item.stat_number.trim()) return null;
  if (typeof item.stat_label !== "string" || !item.stat_label.trim()) return null;
  if (typeof item.stat_description !== "string" || !item.stat_description.trim()) return null;

  return {
    value: item.stat_number.trim(),
    label: item.stat_label.trim(),
    description: item.stat_description.trim(),
  };
};

export const moduleParamsIncludeStatsArray = (params: Record<string, unknown>): boolean =>
  HUBSPOT_STATS_PARAM_KEY in params && Array.isArray(params[HUBSPOT_STATS_PARAM_KEY]);

export const tryMapCustomStatsParamsToCounterSectionProps = (
  params: Record<string, unknown>,
): CustomStatsCounterSectionProps | null => {
  if (!moduleParamsIncludeStatsArray(params)) return null;
  if (!topLevelParamsOnlyAllowNonEmpty(params, CUSTOM_STATS_ALLOWED_TOP_LEVEL_KEYS)) {
    return null;
  }

  const stats = params[HUBSPOT_STATS_PARAM_KEY];
  if (!Array.isArray(stats) || stats.length === 0) return null;

  const mapped: CustomStatsCounterSectionProps["stats"] = [];
  for (const item of stats) {
    const stat = mapStatItem(item);
    if (!stat) return null;
    mapped.push(stat);
  }

  return { stats: mapped };
};
