import {
  isNonEmptyParamValue,
  isPlainObject,
  topLevelParamsOnlyAllowNonEmpty,
} from "../convert-module-params";
import { HUBSPOT_COUNTERS_PARAM_KEY } from "../complex-module-param-keys";

export { HUBSPOT_COUNTERS_PARAM_KEY };
export const HUBSPOT_PIKE_COUNTERS_PATH = "/pikev4/modules/counters";

export const PIKE_COUNTERS_ALLOWED_TOP_LEVEL_KEYS = [
  "animation",
  "child_css",
  "counter_enabled",
  HUBSPOT_COUNTERS_PARAM_KEY,
  "css",
  "css_class",
  "definition_id",
  "field_types",
  "module_id",
  "overrideable",
  "path",
  "schema_version",
  "settings",
  "smart_objects",
  "smart_type",
  "styles",
  "tag",
  "title",
  "type",
  "wrap_field_tag",
] as const;

export interface CounterSectionBlockProps {
  stats: Array<{ value: string; label: string; description?: string }>;
}

const isValidStatNumberContainer = (value: unknown): boolean => {
  if (!isPlainObject(value)) return false;
  for (const key of Object.keys(value)) {
    if (key === "number") {
      if (typeof value.number !== "number" || !Number.isFinite(value.number)) {
        return false;
      }
      continue;
    }
    if (key === "prefix" || key === "suffix") {
      if (typeof value[key] !== "string") return false;
      continue;
    }
    if (key === "formatted" || key === "prefix_superscript" || key === "suffix_superscript") {
      if (typeof value[key] !== "boolean") return false;
      continue;
    }
    if (isNonEmptyParamValue(value[key])) return false;
  }
  return typeof value.number === "number" && Number.isFinite(value.number);
};

const readStatDisplayValue = (stat: Record<string, unknown>): string | null => {
  if (!isValidStatNumberContainer(stat)) return null;
  const prefix = typeof stat.prefix === "string" ? stat.prefix : "";
  const suffix = typeof stat.suffix === "string" ? stat.suffix : "";
  const number = stat.number as number;
  return `${prefix}${number}${suffix}`;
};

const isValidCounterTitleContainer = (value: unknown): boolean => {
  if (!isPlainObject(value)) return false;
  for (const key of Object.keys(value)) {
    if (key === "value") {
      if (typeof value.value !== "string") return false;
      continue;
    }
    if (isNonEmptyParamValue(value[key])) return false;
  }
  return typeof value.value === "string" && value.value.trim().length > 0;
};

const readCounterLabel = (value: unknown): string | undefined => {
  if (!isValidCounterTitleContainer(value)) return undefined;
  if (!isPlainObject(value)) return undefined;
  const label = value.value;
  if (typeof label !== "string") return undefined;
  return label.trim();
};

const isValidStatsDescriptionContainer = (value: unknown): boolean => {
  if (!isPlainObject(value)) return false;
  for (const key of Object.keys(value)) {
    if (key === "stat_description") {
      if (value.stat_description !== null && value.stat_description !== undefined && typeof value.stat_description !== "string") {
        return false;
      }
      continue;
    }
    if (isNonEmptyParamValue(value[key])) return false;
  }
  return true;
};

const readStatDescription = (value: unknown): string | undefined => {
  if (!isValidStatsDescriptionContainer(value)) return undefined;
  if (!isPlainObject(value)) return undefined;
  const raw = value.stat_description;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const mapCounterItem = (item: unknown): CounterSectionBlockProps["stats"][number] | null => {
  if (!isPlainObject(item)) return null;
  for (const key of Object.keys(item)) {
    if (key !== "stat" && key !== "title" && key !== "stats_description" && isNonEmptyParamValue(item[key])) {
      return null;
    }
  }
  if (!isPlainObject(item.stat)) return null;
  const value = readStatDisplayValue(item.stat);
  if (!value) return null;

  const label = readCounterLabel(item.title);
  if (!label) return null;

  if (item.stats_description !== undefined && item.stats_description !== null) {
    if (!isValidStatsDescriptionContainer(item.stats_description)) return null;
  }

  const description = readStatDescription(item.stats_description);
  return description ? { value, label, description } : { value, label };
};

export const moduleParamsIncludePikeCountersArray = (params: Record<string, unknown>): boolean => {
  if (!(HUBSPOT_COUNTERS_PARAM_KEY in params) || !Array.isArray(params[HUBSPOT_COUNTERS_PARAM_KEY])) {
    return false;
  }
  if (params.path !== HUBSPOT_PIKE_COUNTERS_PATH) return false;
  return true;
};

export const tryMapPikeCountersParamsToCounterSectionProps = (
  params: Record<string, unknown>,
): CounterSectionBlockProps | null => {
  if (!moduleParamsIncludePikeCountersArray(params)) return null;
  if (!topLevelParamsOnlyAllowNonEmpty(params, PIKE_COUNTERS_ALLOWED_TOP_LEVEL_KEYS)) {
    return null;
  }

  const counters = params[HUBSPOT_COUNTERS_PARAM_KEY];
  if (!Array.isArray(counters) || counters.length === 0) return null;

  const stats: CounterSectionBlockProps["stats"] = [];
  for (const item of counters) {
    const mapped = mapCounterItem(item);
    if (!mapped) return null;
    stats.push(mapped);
  }

  return { stats };
};
