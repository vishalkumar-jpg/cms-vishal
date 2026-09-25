/**
 * Maps a block's Craft displayName (== type.resolvedName) to the prop key(s)
 * that hold user-visible text the AI text-ops can rewrite. Order matters: the
 * first key whose prop is a non-empty string is treated as the primary target.
 *
 * Prop names are the live block-schema prop names:
 *   Heading/Paragraph → `text`; Button → `label`;
 *   Hero Section / Section Heading → `title` then `subtitle`.
 */
export const TEXT_PROP_MAP: Record<string, string[]> = {
  Heading: ["text"],
  Paragraph: ["text"],
  Text: ["text"],
  Button: ["label"],
  "Hero Section": ["title", "subtitle"],
  "Section Heading": ["title", "subtitle"],
};

/** The Image block type name and its alt-text prop. */
export const IMAGE_BLOCK = "Image";
export const IMAGE_ALT_PROP = "altText";
export const IMAGE_URL_PROP = "imageUrl";

export interface TextTarget {
  key: string;
  value: string;
}

/** Resolve which prop to transform for a block, given its current props. */
export function resolveTextTarget(
  displayName: string,
  props: Record<string, unknown>,
): TextTarget | null {
  const keys = TEXT_PROP_MAP[displayName];
  if (!keys) return null;
  // Prefer the first non-empty string prop; fall back to the first key.
  for (const key of keys) {
    const v = props[key];
    if (typeof v === "string" && v.trim().length > 0) return { key, value: v };
  }
  const first = keys[0];
  const v = props[first];
  return { key: first, value: typeof v === "string" ? v : "" };
}

/** Does this block expose any AI-editable text? */
export function supportsTextAi(displayName: string): boolean {
  return Boolean(TEXT_PROP_MAP[displayName]);
}
