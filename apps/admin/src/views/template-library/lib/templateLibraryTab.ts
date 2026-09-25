export type TemplateLibraryTab = "starter" | "mine";

/** Normalize URL tab param — unknown values default to starter. */
export const parseTemplateLibraryTab = (
  value: string | null | undefined,
): TemplateLibraryTab => (value === "mine" ? "mine" : "starter");
