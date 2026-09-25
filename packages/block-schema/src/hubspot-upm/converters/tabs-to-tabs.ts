import {
  isNonEmptyParamValue,
  isPlainObject,
  isValidHubSpotObjectTextContainer,
  readHubSpotObjectTextField,
  topLevelParamsOnlyAllowNonEmpty,
} from "../convert-module-params";
import { HUBSPOT_TABS_PARAM_KEY } from "../complex-module-param-keys";

export { HUBSPOT_TABS_PARAM_KEY };
export const HUBSPOT_PIKE_TABS_PATH = "/pikev4/modules/tabs";

/** Non-empty top-level keys observed on the harvested Pike tabs fixture. */
export const PIKE_TABS_ALLOWED_TOP_LEVEL_KEYS = [
  "animation",
  "child_css",
  "css",
  "css_class",
  "module_id",
  "overrideable",
  "path",
  "schema_version",
  "settings",
  "smart_objects",
  "smart_type",
  "styles",
  HUBSPOT_TABS_PARAM_KEY,
  "type",
  "wrap_field_tag",
] as const;

export interface TabsBlockProps {
  tabs: Array<{ label: string; content: string }>;
}

const isValidTabDescriptionContainer = (value: unknown): boolean => {
  if (!isPlainObject(value)) return false;
  for (const key of Object.keys(value)) {
    if (key === "text") {
      const text = value.text;
      if (text !== null && text !== undefined && typeof text !== "string") {
        return false;
      }
      continue;
    }
    if (isNonEmptyParamValue(value[key])) return false;
  }
  return true;
};

const isValidTabContentItem = (value: unknown): value is { content: string } => {
  if (!isPlainObject(value)) return false;
  for (const key of Object.keys(value)) {
    if (key === "content") {
      if (typeof value.content !== "string") return false;
      continue;
    }
    if (isNonEmptyParamValue(value[key])) return false;
  }
  return typeof value.content === "string" && value.content.trim().length > 0;
};

const mapTabItem = (item: unknown): TabsBlockProps["tabs"][number] | null => {
  if (!isPlainObject(item)) return null;
  for (const key of Object.keys(item)) {
    if (key !== "title" && key !== "description" && key !== "contents" && isNonEmptyParamValue(item[key])) {
      return null;
    }
  }
  if (!isValidHubSpotObjectTextContainer(item.title)) return null;
  const label = readHubSpotObjectTextField(item.title);
  if (!label) return null;

  if (item.description !== undefined && item.description !== null) {
    if (!isValidTabDescriptionContainer(item.description)) return null;
  }

  const contents = item.contents;
  if (!Array.isArray(contents) || contents.length !== 1) return null;
  if (!isValidTabContentItem(contents[0])) return null;

  return { label, content: contents[0]!.content };
};

export const moduleParamsIncludePikeTabsArray = (params: Record<string, unknown>): boolean => {
  if (!(HUBSPOT_TABS_PARAM_KEY in params) || !Array.isArray(params[HUBSPOT_TABS_PARAM_KEY])) {
    return false;
  }
  if (params.path !== HUBSPOT_PIKE_TABS_PATH) return false;
  return true;
};

export const tryMapPikeTabsParamsToTabsProps = (
  params: Record<string, unknown>,
): TabsBlockProps | null => {
  if (!moduleParamsIncludePikeTabsArray(params)) return null;
  if (!topLevelParamsOnlyAllowNonEmpty(params, PIKE_TABS_ALLOWED_TOP_LEVEL_KEYS)) {
    return null;
  }

  const tabs = params[HUBSPOT_TABS_PARAM_KEY];
  if (!Array.isArray(tabs) || tabs.length === 0) return null;

  const mapped: TabsBlockProps["tabs"] = [];
  for (const item of tabs) {
    const tab = mapTabItem(item);
    if (!tab) return null;
    mapped.push(tab);
  }

  return { tabs: mapped };
};
