import type { Template } from "@/views/templates/types";

/** Simulates a pre-`kind` API template row in regression tests only. */
export const legacyTemplateFixture = (overrides: Omit<Template, "kind">): Template =>
  overrides as unknown as Template;
