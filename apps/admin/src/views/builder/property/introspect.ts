import { z } from "zod";

/**
 * Introspects a block's zod propSchema into a flat list of form-control specs.
 * Drives the auto-generated property panel. We unwrap Optional/Default/Nullable
 * wrappers to find the base zod type, then map it to a control kind.
 *
 * Style/nested-record fields (e.g. `styles`, `*Styles`, `textStyles`) are
 * EXCLUDED here — those are handled by the dedicated StyleControls panel.
 */
export type ControlKind =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "url"
  | "image"
  | "color"
  | "array"
  | "json"
  | "form"
  | "collection"
  | "html"
  | "icon";

export interface FieldSpec {
  name: string;
  kind: ControlKind;
  options?: string[];
  label: string;
}

/** Field name fragments that denote an image/media reference. */
const IMAGE_FIELD = /(image|logo|avatar|cover|photo|icon|background)/i;

const STYLE_FIELD = /styles$|^styles$/i;
const NESTED_RECORD_FIELDS = new Set(["buttons", "items", "columns", "links", "cards", "logos"]);

/** Peel Optional/Default/Nullable/Effects to the inner schema. */
const unwrap = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  let current = schema;
  // Guard against pathological nesting.
  for (let i = 0; i < 8; i += 1) {
    const def = current._def as { typeName?: string; innerType?: z.ZodTypeAny; schema?: z.ZodTypeAny };
    if (
      def.typeName === z.ZodFirstPartyTypeKind.ZodOptional ||
      def.typeName === z.ZodFirstPartyTypeKind.ZodNullable ||
      def.typeName === z.ZodFirstPartyTypeKind.ZodDefault
    ) {
      current = def.innerType as z.ZodTypeAny;
      continue;
    }
    if (def.typeName === z.ZodFirstPartyTypeKind.ZodEffects && def.schema) {
      current = def.schema;
      continue;
    }
    break;
  }
  return current;
};

const labelize = (name: string): string => {
  if (FRIENDLY_FIELD_LABELS[name]) return FRIENDLY_FIELD_LABELS[name];
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/Url/g, "URL")
    .replace(/Svg/g, "SVG")
    .replace(/Id/g, "ID")
    .trim();
};

/** Plain-English labels for auto-generated content fields. */
const FRIENDLY_FIELD_LABELS: Record<string, string> = {
  imageUrl: "Image",
  altText: "Image description (for screen readers)",
  highlightText: "Highlighted words",
  highlightColor: "Highlight color",
  inlineSvg: "SVG code",
  formId: "Form",
  collectionSlug: "Content collection",
  reusableBlockId: "Reusable block",
  html: "Embed code",
  href: "Link address",
  url: "Link address",
  src: "Video source",
  poster: "Cover image",
  provider: "Video provider",
  mode: "Display mode",
  autoplay: "Play automatically",
  loop: "Loop video",
  muted: "Start muted",
  controls: "Show player controls",
  placeholder: "Placeholder text",
  buttonLabel: "Button label",
  showButton: "Show search button",
  iconAfter: "Icon after text",
  strokeWidth: "Line thickness",
  objectFit: "How image fits",
  figureClassName: "Figure class",
  sizes: "Responsive image sizes",
  loading: "When to load image",
  logoImageHeight: "Logo height (px)",
  logoUrl: "Logo link (page or URL)",
  ctaUrl: "Button link (page or URL)",
  level: "Heading level",
  variant: "Button style",
  name: "Icon",
  label: "Button text",
  text: "Text",
  title: "Title",
  subtitle: "Subtitle",
  description: "Description",
  featuresText: "Features (one per line)",
  triggerLabel: "Button text",
  allowMultiple: "Allow multiple open at once",
  address: "Address",
  embedUrl: "Embed link (optional)",
  lightbox: "Open full-size on click",
  columns: "Columns",
  period: "Billing period",
  role: "Role / title",
  photo: "Photo",
  countUp: "Count up from 0 (on scroll)",
  countUpDuration: "Count-up speed (ms)",
  countUpDelay: "Count-up delay (ms)",
  countUpEasing: "Count-up motion style",
};

/**
 * Machine-managed props captured automatically when an image is picked from the
 * media library (responsive variants, intrinsic dimensions, focal point). These
 * are not hand-edited, so they're hidden from the auto-generated controls — the
 * user-facing knobs are `sizes` + `loading`.
 */
const HIDDEN_FIELDS = new Set([
  "variants",
  "intrinsicwidth",
  "intrinsicheight",
  "focalpoint",
]);

const kindForField = (name: string, schema: z.ZodTypeAny): ControlKind | null => {
  if (STYLE_FIELD.test(name)) return null;
  if (HIDDEN_FIELDS.has(name.toLowerCase())) return null;
  const base = unwrap(schema);
  const typeName = (base._def as { typeName?: string }).typeName;

  // Heuristic naming for color/url controls.
  const lower = name.toLowerCase();
  if (typeName === z.ZodFirstPartyTypeKind.ZodString) {
    // The Form block's `formId` opens the dedicated form picker.
    if (name === "formId") return "form";
    // The Collection List block's `collectionSlug` opens the collection picker.
    if (name === "collectionSlug") return "collection";
    // The ReusableBlock's reference is set by insertion / the Reusable panel,
    // not edited as free text — hide it from the auto-generated controls.
    if (name === "reusableBlockId") return null;
    // The Embed block's `html` prop opens a multiline raw-HTML / embed-code editor.
    if (name === "html") return "html";
    // The Icon block's `name` prop opens the searchable lucide icon picker.
    if (name === "name") return "icon";
    // The Image block's `inlineSvg` prop opens a multiline paste area (sanitized SVG).
    if (name === "inlineSvg") return "textarea";
    if (lower.includes("color")) return "color";
    // Image/media references (coverUrl, avatarUrl, …) — but not logoUrl/ctaUrl page links.
    if (
      IMAGE_FIELD.test(name) &&
      lower !== "logourl" &&
      lower !== "ctaurl" &&
      (lower.includes("url") || lower.includes("src") || lower === "image")
    ) {
      return "image";
    }
    // Link destinations (logoUrl, ctaUrl, href, …) → internal page picker.
    if (
      lower === "logourl" ||
      lower === "ctaurl" ||
      lower.endsWith("href") ||
      (lower.endsWith("url") &&
        !lower.includes("image") &&
        lower !== "embedurl" &&
        lower !== "videourl" &&
        lower !== "posterurl")
    ) {
      return "url";
    }
    if (lower.includes("url") || lower.includes("href") || lower.includes("link")) return "url";
    if (
      lower.includes("text") ||
      lower.includes("description") ||
      lower.includes("subtitle") ||
      lower === "content" ||
      lower === "bio" ||
      lower === "answer"
    ) {
      return "textarea";
    }
    return "text";
  }
  if (typeName === z.ZodFirstPartyTypeKind.ZodNumber) return "number";
  if (typeName === z.ZodFirstPartyTypeKind.ZodBoolean) return "boolean";
  if (typeName === z.ZodFirstPartyTypeKind.ZodEnum) return "select";
  if (typeName === z.ZodFirstPartyTypeKind.ZodNativeEnum) return "select";
  // Arrays of records / nested objects / records -> raw JSON editor.
  if (typeName === z.ZodFirstPartyTypeKind.ZodArray) {
    if (lower.endsWith("styles")) return null;
    // Repeatable item collections (nav items, features, slides, logos, ...) get
    // a friendly add/remove/reorder editor; everything else falls back to JSON.
    return "array";
  }
  if (
    typeName === z.ZodFirstPartyTypeKind.ZodObject ||
    typeName === z.ZodFirstPartyTypeKind.ZodRecord
  ) {
    if (NESTED_RECORD_FIELDS.has(lower)) return "json";
    // Skip ad-hoc style-ish record bags (e.g. `partStyles`, `ctaStyles`).
    if (lower.endsWith("styles")) return null;
    return "json";
  }
  return "text";
};

const enumOptions = (schema: z.ZodTypeAny): string[] | undefined => {
  const base = unwrap(schema);
  const def = base._def as { typeName?: string; values?: unknown };
  if (def.typeName === z.ZodFirstPartyTypeKind.ZodEnum) {
    return def.values as string[];
  }
  if (def.typeName === z.ZodFirstPartyTypeKind.ZodNativeEnum) {
    return Object.values(def.values as Record<string, string>);
  }
  return undefined;
};

/** Returns the field specs for a block schema, or [] if not a ZodObject. */
export const introspectSchema = (schema: z.ZodTypeAny | undefined): FieldSpec[] => {
  if (!schema) return [];
  const base = unwrap(schema);
  const def = base._def as { typeName?: string; shape?: () => Record<string, z.ZodTypeAny> };
  if (def.typeName !== z.ZodFirstPartyTypeKind.ZodObject || !def.shape) return [];
  const shape = def.shape();
  const specs: FieldSpec[] = [];
  for (const [name, fieldSchema] of Object.entries(shape)) {
    const kind = kindForField(name, fieldSchema);
    if (!kind) continue;
    specs.push({
      name,
      kind,
      label: labelize(name),
      options: kind === "select" ? enumOptions(fieldSchema) : undefined,
    });
  }
  return specs;
};

export { labelize };

/**
 * For an array-typed field on a block schema, returns the per-item field specs
 * (if the element is an object) so the array editor can render structured rows.
 * Returns null when the element isn't an object (fallback to JSON-ish editing).
 */
export const introspectArrayItem = (
  schema: z.ZodTypeAny | undefined,
  fieldName: string,
): { fields: FieldSpec[]; makeDefault: () => Record<string, unknown> } | null => {
  if (!schema) return null;
  const base = unwrap(schema);
  const def = base._def as { typeName?: string; shape?: () => Record<string, z.ZodTypeAny> };
  if (def.typeName !== z.ZodFirstPartyTypeKind.ZodObject || !def.shape) return null;
  const arrSchema = def.shape()[fieldName];
  if (!arrSchema) return null;
  const arrBase = unwrap(arrSchema);
  const arrDef = arrBase._def as { typeName?: string; type?: z.ZodTypeAny };
  if (arrDef.typeName !== z.ZodFirstPartyTypeKind.ZodArray || !arrDef.type) return null;
  const elementSpecs = introspectSchema(arrDef.type);
  if (elementSpecs.length === 0) return null;
  const makeDefault = (): Record<string, unknown> => {
    const item: Record<string, unknown> = {};
    for (const f of elementSpecs) {
      item[f.name] =
        f.kind === "boolean" ? false : f.kind === "number" ? 0 : f.kind === "array" ? [] : "";
    }
    return item;
  };
  return { fields: elementSpecs, makeDefault };
};
