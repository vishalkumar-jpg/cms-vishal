import {
  CURRENT_SCHEMA_VERSION,
  serializedLayoutSchema,
  type SerializedLayout,
} from "./layout";
import { repairLayout } from "./repair";

/**
 * Versioned migration pass (TECH-ARCHITECTURE §2.2). Upgrades an older layout to
 * `CURRENT_SCHEMA_VERSION` then runs the node repair pass. Add a migrator per
 * version bump; never hard-break a block's props.
 *
 * The POC export uses metadata.version "2.0" which is already the current
 * schema, so it is repaired and stamped without transformation.
 */

type Migrator = (layout: SerializedLayout) => SerializedLayout;

/** fromVersion -> migrator that brings it to the next version. */
const migrators: Record<string, Migrator> = {
  // "1.0": (layout) => ({ ...layout, schemaVersion: "2.0", nodes: transform(layout.nodes) }),
};

/**
 * Migrate + repair a layout to the current schema version.
 * @param input  a SerializedLayout-shaped object (already has root/nodes).
 * @param fromVersion optional override for the source version.
 */
export const migrate = (input: unknown, fromVersion?: string): SerializedLayout => {
  // Tolerant parse: coerce/repair rather than throw on minor shape drift.
  const parsed = serializedLayoutSchema.safeParse(input);
  let layout: SerializedLayout = parsed.success
    ? parsed.data
    : ({
        schemaVersion: fromVersion ?? CURRENT_SCHEMA_VERSION,
        root: (input as any)?.root ?? "ROOT",
        nodes: (input as any)?.nodes ?? {},
      } as SerializedLayout);

  if (fromVersion) layout = { ...layout, schemaVersion: fromVersion };

  // Run any chained migrators up to the current version.
  let guard = 0;
  while (layout.schemaVersion !== CURRENT_SCHEMA_VERSION && guard < 20) {
    const m = migrators[layout.schemaVersion];
    if (!m) break;
    layout = m(layout);
    guard++;
  }

  layout = repairLayout({ ...layout, schemaVersion: CURRENT_SCHEMA_VERSION });
  return layout;
};

/** Back-compat alias. */
export const migrateLayout = (input: unknown): SerializedLayout => migrate(input);
