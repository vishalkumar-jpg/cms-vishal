import { buildSiteDesignProfile } from "../universal-design/build-site-design-profile";
import { resolveUniversalDesignToStyleModel } from "../universal-design/resolve-to-style-model";
import type {
  DesignExtractionDiagnostic,
  PageDesignContract,
  PageDesignNodeRef,
  UniversalDesignData,
  UniversalDesignUnresolved,
} from "../universal-design/types";
import { UNIVERSAL_DESIGN_DATA_VERSION } from "../universal-design/types";
import {
  extractHubspotDesignFromSourceNode,
  type HubspotDesignEntry,
  type HubspotDesignLosslessSlice,
} from "./hubspot-design-extract";
import type { HubspotSourceNode, HubspotUniversalPage } from "./types";

export interface HubspotNodeDesignBundle {
  sourcePath: string;
  nodeId: string;
  parentNodeId?: string;
  nodeKind: string;
  entries: HubspotDesignEntry[];
  resolved: Array<
    ReturnType<typeof resolveUniversalDesignToStyleModel> & { entryKey: string; hubspotLocator: string }
  >;
  losslessSlices: HubspotDesignLosslessSlice[];
}

export interface HubspotPageDesignContract {
  version: typeof UNIVERSAL_DESIGN_DATA_VERSION;
  nodes: HubspotNodeDesignBundle[];
  pageDesign: PageDesignContract;
  diagnostics: DesignExtractionDiagnostic[];
}

const visitNodes = (nodes: HubspotSourceNode[], visit: (node: HubspotSourceNode) => void): void => {
  for (const node of nodes) {
    visit(node);
    visitNodes(node.children, visit);
  }
};

const INFO_DESIGN_DIAGNOSTIC_CODES = new Set(["DESIGN_THEME_CLASS", "DESIGN_MOTION_DEFERRED"]);

const unresolvedToDesignDiagnostic = (
  item: UniversalDesignUnresolved,
  sourcePath: string,
  locator: string,
): DesignExtractionDiagnostic => ({
  code: item.code,
  severity: INFO_DESIGN_DIAGNOSTIC_CODES.has(item.code) ? "info" : "warning",
  message: item.detail ? `${item.message} (${item.detail})` : item.message,
  sourcePath,
  locator,
});

const compareDesignDiagnostics = (
  a: DesignExtractionDiagnostic,
  b: DesignExtractionDiagnostic,
): number =>
  (a.sourcePath ?? "").localeCompare(b.sourcePath ?? "") ||
  (a.locator ?? "").localeCompare(b.locator ?? "") ||
  a.code.localeCompare(b.code) ||
  a.message.localeCompare(b.message);

/**
 * Full H2 design contract for a HubSpot UPM page.
 * H2 should consume `nodes[]` (keyed by sourcePath + entryKey) and `losslessSlices` — not raw HubSpot JSON.
 */
export const buildHubspotPageDesignContract = (
  upm: HubspotUniversalPage,
): HubspotPageDesignContract => {
  const diagnostics: DesignExtractionDiagnostic[] = [];
  const nodes: HubspotNodeDesignBundle[] = [];
  const allDesignData: UniversalDesignData[] = [];
  const pageNodes: PageDesignNodeRef[] = [];

  for (const region of upm.regions) {
    visitNodes(region.nodes, (node) => {
      const extracted = extractHubspotDesignFromSourceNode(node);
      if (extracted.entries.length === 0 && extracted.losslessSlices.length === 0) return;

      const resolved = extracted.entries.map((entry) => ({
        entryKey: entry.entryKey,
        hubspotLocator: entry.hubspotLocator,
        ...resolveUniversalDesignToStyleModel(entry.data),
      }));
      for (const entry of extracted.entries) allDesignData.push(entry.data);
      diagnostics.push(...extracted.diagnostics);
      for (const resolvedEntry of resolved) {
        for (const item of resolvedEntry.unresolved) {
          diagnostics.push(
            unresolvedToDesignDiagnostic(item, node.sourcePath, resolvedEntry.hubspotLocator),
          );
        }
      }

      const bundle: HubspotNodeDesignBundle = {
        sourcePath: node.sourcePath,
        nodeId: node.id,
        parentNodeId: node.provenance.parentNodeId,
        nodeKind: node.nodeKind,
        entries: extracted.entries,
        resolved,
        losslessSlices: extracted.losslessSlices,
      };
      nodes.push(bundle);

      pageNodes.push({
        sourcePath: node.sourcePath,
        nodeId: node.id,
        parentNodeId: node.provenance.parentNodeId,
        nodeKind: node.nodeKind,
        designs: extracted.entries.map((entry) => ({
          entryKey: entry.entryKey,
          role: entry.role,
          data: entry.data,
        })),
        resolved,
        losslessSlices: extracted.losslessSlices,
      });
    });
  }

  nodes.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  pageNodes.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  diagnostics.sort(compareDesignDiagnostics);
  const profile = buildSiteDesignProfile(allDesignData);

  const pageDesign: PageDesignContract = {
    version: UNIVERSAL_DESIGN_DATA_VERSION,
    nodes: pageNodes,
    profile,
    diagnostics,
  };

  return {
    version: UNIVERSAL_DESIGN_DATA_VERSION,
    nodes,
    pageDesign,
    diagnostics,
  };
};
