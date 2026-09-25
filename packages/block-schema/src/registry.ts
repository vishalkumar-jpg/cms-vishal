/**
 * Back-compat shim. The block prop-schema registry now lives in `block-props.ts`
 * (all 28 blocks). `blockSchemaRegistry` is kept as an alias of the canonical
 * `blockPropSchemas` for existing imports.
 */
import { blockPropSchemas } from "./block-props";

export const blockSchemaRegistry = blockPropSchemas;
