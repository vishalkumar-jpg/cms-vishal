import type { StyleModel } from "../styles";
import { styleModelSchema } from "../styles";
import { mergeStyleModels } from "../universal-design/resolve-to-style-model";
import type { DesignExtractionDiagnostic } from "../universal-design/types";
import type { HubspotNodeDesignBundle, HubspotPageDesignContract } from "./hubspot-design-contract";
import {
  hubspotDesignRoleMapForBlock,
  type HubspotDesignApplicationTarget,
} from "./hubspot-design-part-map";
import type { BlockNode } from "../layout";
import { HUBSPOT_LAYOUT_CUSTOM_KEY } from "./hubspot-node-custom";
import type { HubspotExtractionDiagnostic } from "./types";

export const DESIGN_APPLY_ROLE_UNMAPPED = "DESIGN_APPLY_ROLE_UNMAPPED";
export const DESIGN_APPLY_NO_BUNDLE = "DESIGN_APPLY_NO_BUNDLE";

export interface HubspotDesignApplyResult {
  block: BlockNode;
  appliedEntryKeys: string[];
  diagnostics: HubspotExtractionDiagnostic[];
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value);

const parseStyleModel = (value: unknown): StyleModel => {
  if (!isPlainObject(value)) return {};
  const parsed = styleModelSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
};

const isNonEmptyObject = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;

/** True when the resolved StyleModel has at least one applicable section (H2 apply gate). */
const styleModelHasApplicableSections = (model: StyleModel): boolean => {
  if (!isPlainObject(model)) return false;
  for (const [key, value] of Object.entries(model)) {
    if (key === "responsive") {
      if (!isPlainObject(value)) continue;
      if (Object.values(value).some((layer) => styleModelHasApplicableSections(layer as StyleModel))) {
        return true;
      }
      continue;
    }
    if (isNonEmptyObject(value)) return true;
    if (value != null && (typeof value !== "object" || Array.isArray(value))) return true;
  }
  return false;
};

const mergeIntoProps = (
  props: Record<string, unknown>,
  target: HubspotDesignApplicationTarget,
  styleModel: StyleModel,
): Record<string, unknown> => {
  if (target.kind === "root") {
    const styles = mergeStyleModels(parseStyleModel(props.styles), styleModel);
    return { ...props, styles };
  }
  const partStylesRaw = props.partStyles;
  const partStyles: Record<string, unknown> = isPlainObject(partStylesRaw) ? { ...partStylesRaw } : {};
  const existing = parseStyleModel(partStyles[target.partKey]);
  partStyles[target.partKey] = mergeStyleModels(existing, styleModel);
  return { ...props, partStyles };
};

const toLayoutDiagnostic = (
  diagnostic: Omit<HubspotExtractionDiagnostic, "severity"> & { severity?: HubspotExtractionDiagnostic["severity"] },
): HubspotExtractionDiagnostic => ({
  severity: diagnostic.severity ?? "info",
  code: diagnostic.code,
  message: diagnostic.message,
  path: diagnostic.path,
  hubspotType: diagnostic.hubspotType,
});

export const indexHubspotDesignBundlesBySourcePath = (
  contract: HubspotPageDesignContract,
): Map<string, HubspotNodeDesignBundle> => {
  const map = new Map<string, HubspotNodeDesignBundle>();
  for (const bundle of contract.nodes) {
    map.set(bundle.sourcePath, bundle);
  }
  return map;
};

/**
 * Apply pre-resolved H1 design entries to a native block node (pure, no UPM mutation).
 */
export const applyHubspotDesignToBlock = (input: {
  block: BlockNode;
  resolvedName: string;
  sourcePath: string;
  bundle: HubspotNodeDesignBundle | undefined;
}): HubspotDesignApplyResult => {
  const diagnostics: HubspotExtractionDiagnostic[] = [];
  const roleMap = hubspotDesignRoleMapForBlock(input.resolvedName);
  if (!roleMap) {
    return { block: input.block, appliedEntryKeys: [], diagnostics };
  }
  if (!input.bundle) {
    return { block: input.block, appliedEntryKeys: [], diagnostics };
  }

  let props = { ...(input.block.props as Record<string, unknown>) };
  const appliedEntryKeys: string[] = [];
  const sortedResolved = [...input.bundle.resolved].sort((a, b) => a.entryKey.localeCompare(b.entryKey));

  for (const resolvedEntry of sortedResolved) {
    const target = roleMap[resolvedEntry.role];
    if (!target) {
      if (styleModelHasApplicableSections(resolvedEntry.styleModel)) {
        diagnostics.push(
          toLayoutDiagnostic({
            code: DESIGN_APPLY_ROLE_UNMAPPED,
            severity: "info",
            message: `Design role not mapped for ${input.resolvedName}; entry preserved in contract only.`,
            path: input.sourcePath,
          }),
        );
      }
      continue;
    }
    if (!styleModelHasApplicableSections(resolvedEntry.styleModel)) {
      continue;
    }
    props = mergeIntoProps(props, target, resolvedEntry.styleModel);
    appliedEntryKeys.push(resolvedEntry.entryKey);
  }

  const custom = { ...(input.block.custom ?? {}) };
  const hubspotCustom = isPlainObject(custom[HUBSPOT_LAYOUT_CUSTOM_KEY])
    ? { ...(custom[HUBSPOT_LAYOUT_CUSTOM_KEY] as Record<string, unknown>) }
    : {};
  if (appliedEntryKeys.length > 0) {
    hubspotCustom.appliedDesignEntryKeys = [...appliedEntryKeys].sort();
    custom[HUBSPOT_LAYOUT_CUSTOM_KEY] = hubspotCustom;
  }

  return {
    block: {
      ...input.block,
      props,
      custom,
    },
    appliedEntryKeys,
    diagnostics,
  };
};

export const designContractDiagnosticsToLayout = (
  contractDiagnostics: DesignExtractionDiagnostic[],
): HubspotExtractionDiagnostic[] =>
  contractDiagnostics.map((d) =>
    toLayoutDiagnostic({
      code: d.code,
      severity: d.severity,
      message: d.locator ? `${d.message} [${d.locator}]` : d.message,
      path: d.sourcePath,
    }),
  );
