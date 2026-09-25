import {
  isNonEmptyParamValue,
  isPlainObject,
  topLevelParamsOnlyAllowNonEmpty,
} from "../convert-module-params";
import { HUBSPOT_STEPS_PARAM_KEY } from "../complex-module-param-keys";

export { HUBSPOT_STEPS_PARAM_KEY };

/** Strict top-level allowlist (corpus custom steps module metadata only). */
export const CUSTOM_STEPS_ALLOWED_TOP_LEVEL_KEYS = [
  "css_class",
  "module_id",
  "schema_version",
  HUBSPOT_STEPS_PARAM_KEY,
] as const;

export interface StepCardsBlockProps {
  steps: Array<{ number: string; title: string; description: string }>;
}

const mapStepItem = (
  item: unknown,
  index: number,
): StepCardsBlockProps["steps"][number] | null => {
  if (!isPlainObject(item)) return null;
  for (const key of Object.keys(item)) {
    if (key !== "step_title" && key !== "step_description" && isNonEmptyParamValue(item[key])) {
      return null;
    }
  }
  if (typeof item.step_title !== "string" || !item.step_title.trim()) return null;
  if (typeof item.step_description !== "string" || !item.step_description.trim()) return null;

  return {
    number: String(index + 1),
    title: item.step_title.trim(),
    description: item.step_description.trim(),
  };
};

export const moduleParamsIncludeStepsArray = (params: Record<string, unknown>): boolean =>
  HUBSPOT_STEPS_PARAM_KEY in params && Array.isArray(params[HUBSPOT_STEPS_PARAM_KEY]);

export const tryMapCustomStepsParamsToStepCardsProps = (
  params: Record<string, unknown>,
): StepCardsBlockProps | null => {
  if (!moduleParamsIncludeStepsArray(params)) return null;
  if (!topLevelParamsOnlyAllowNonEmpty(params, CUSTOM_STEPS_ALLOWED_TOP_LEVEL_KEYS)) {
    return null;
  }

  const steps = params[HUBSPOT_STEPS_PARAM_KEY];
  if (!Array.isArray(steps) || steps.length === 0) return null;

  const mapped: StepCardsBlockProps["steps"] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = mapStepItem(steps[i], i);
    if (!step) return null;
    mapped.push(step);
  }

  return { steps: mapped };
};
