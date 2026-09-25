/**
 * Sub-part tagging for composite blocks.
 *
 * A composite block (e.g. a Hero "card": image + title + description + button)
 * renders its internal parts from a SINGLE Craft node — the parts are not nodes
 * themselves. To let the builder select and edit an individual part we tag its
 * DOM element with `data-subpart` attributes. These are inert in the renderer
 * (plain data-* attributes) and read by the admin builder to hit-test the click,
 * paint a hover/selection highlight, and scope the property panel to that part.
 *
 * Paths are prop paths on the OWNING node:
 *  - `text`  : the editable text prop (e.g. `"title"`).
 *  - `style` : the per-part StyleModel bag (e.g. `"partStyles.title"`).
 *  - `image` : the image url prop (e.g. `"imageUrl"`).
 */
export interface SubPartOptions {
  label: string;
  text?: string;
  style?: string;
  image?: string;
}

/** Build the `data-subpart*` attribute bag for a tagged element. */
export const subpartAttrs = (
  key: string,
  opts: SubPartOptions,
): Record<string, string | undefined> => ({
  "data-subpart": key,
  "data-subpart-label": opts.label,
  "data-subpart-text": opts.text,
  "data-subpart-style": opts.style,
  "data-subpart-image": opts.image,
});
