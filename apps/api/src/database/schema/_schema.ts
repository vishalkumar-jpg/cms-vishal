import { pgSchema } from "drizzle-orm/pg-core";

/** All application tables live in the dedicated `ob_cms` schema (not `public`). */
export const obCmsSchema = pgSchema("ob_cms");
