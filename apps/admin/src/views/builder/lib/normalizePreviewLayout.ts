import {
  hydrateNavbarNodes,
  hydratePartnersLogoGrid,
} from "@ob-cms/blocks";
import { migrate, type SerializedLayout } from "@ob-cms/block-schema";

/** Migrate and apply the same hydration passes as full-page draft preview. */
export const normalizePreviewLayout = (
  raw: SerializedLayout | Record<string, unknown> | null | undefined,
): SerializedLayout | null => {
  if (!raw) return null;
  try {
    const migrated = migrate(raw as SerializedLayout);
    const hydratedNav = hydrateNavbarNodes(migrated.nodes as Record<string, unknown>);
    const baseNodes = hydratedNav.changed
      ? hydratedNav.nodes
      : (migrated.nodes as Record<string, unknown>);
    const hydratedPartners = hydratePartnersLogoGrid(baseNodes);
    const nodes = hydratedPartners.changed ? hydratedPartners.nodes : baseNodes;
    return (hydratedNav.changed || hydratedPartners.changed
      ? { ...migrated, nodes }
      : migrated) as SerializedLayout;
  } catch {
    return null;
  }
};
