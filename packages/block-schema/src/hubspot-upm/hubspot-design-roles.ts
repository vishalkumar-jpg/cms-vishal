import { designPartRole, designSettingsRole, DESIGN_ROLE_MODULE_ROOT, DESIGN_ROLE_STRUCTURAL } from "../universal-design/semantic-tokens";

/** Map HubSpot module `styles` top-level keys to source-agnostic part roles. */
export const hubspotModuleStylesKeyToRole = (key: string): string => {
  if (key === "layout" || key === "visibility") return designPartRole(key);
  return designPartRole(key);
};

export const hubspotStyleSettingsGroupToRole = (group: string, field: string): string =>
  designSettingsRole(group, field);

export { DESIGN_ROLE_MODULE_ROOT, DESIGN_ROLE_STRUCTURAL, designPartRole, designSettingsRole };
