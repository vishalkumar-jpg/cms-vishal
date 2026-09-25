const PARTNERS_HEADING = /meet our strategic partnerships/i;

const PARTNERS_GRID_CLASSES = ["ob-grid-cols-5", "ob-partners-logo-grid", "ob-no-auto-loop"] as const;

type LayoutNode = {
  type?: { resolvedName?: string };
  props?: Record<string, unknown>;
  parent?: string;
  nodes?: string[];
};

function findSectionId(nodes: Record<string, unknown>, startId: string): string | null {
  let id: string | undefined = startId;
  while (id) {
    const node = nodes[id] as LayoutNode | undefined;
    if (!node) return null;
    if (node.type?.resolvedName === "Section") return id;
    id = node.parent;
  }
  return null;
}

function sectionHasPartnersHeading(nodes: Record<string, unknown>, sectionId: string): boolean {
  const section = nodes[sectionId] as LayoutNode | undefined;
  if (!section?.nodes?.length) return false;

  const stack = [...section.nodes];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id) continue;
    const node = nodes[id] as LayoutNode | undefined;
    if (!node) continue;
    if (node.type?.resolvedName === "Heading") {
      const text = String(node.props?.text ?? "");
      if (PARTNERS_HEADING.test(text)) return true;
    }
    if (node.nodes?.length) stack.push(...node.nodes);
  }
  return false;
}

function mergePartnersGridClassName(className: unknown): string {
  const parts = String(className ?? "")
    .split(/\s+/)
    .filter(Boolean);
  for (const cls of PARTNERS_GRID_CLASSES) {
    if (!parts.includes(cls)) parts.push(cls);
  }
  return parts.join(" ");
}

/**
 * Patch the strategic-partnerships logo grid on saved layouts that predate the
 * mobile slider classes (`ob-partners-logo-grid`, `ob-no-auto-loop`).
 */
export const hydratePartnersLogoGrid = (
  nodes: Record<string, unknown>,
): { nodes: Record<string, unknown>; changed: boolean } => {
  let changed = false;
  const next: Record<string, unknown> = { ...nodes };

  for (const [id, raw] of Object.entries(nodes)) {
    const node = raw as LayoutNode;
    if (node.type?.resolvedName !== "Grid") continue;
    if (Number(node.props?.columns) !== 5) continue;

    const className = String(node.props?.className ?? "");
    if (className.includes("ob-partners-logo-grid")) continue;

    const parentId = node.parent;
    if (!parentId) continue;
    const sectionId = findSectionId(nodes, parentId);
    if (!sectionId || !sectionHasPartnersHeading(nodes, sectionId)) continue;

    const merged = mergePartnersGridClassName(className);
    if (merged === className) continue;

    next[id] = {
      ...node,
      props: { ...node.props, className: merged },
    };
    changed = true;
  }

  return { nodes: changed ? next : nodes, changed };
};
