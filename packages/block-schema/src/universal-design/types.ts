import { z } from "zod";
import type { StyleModel } from "../styles";

/** Source-agnostic universal design model (UDD) — version 1. */
export const UNIVERSAL_DESIGN_DATA_VERSION = "1" as const;

/** HubSpot/UDD normalized color opacity scale maximum (0–100). */
export const MAX_COLOR_OPACITY = 100;

export const universalDesignResponsiveBucketSchema = z.enum([
  "tablet",
  "mobile",
  "largeDesktop",
]);

export type UniversalDesignResponsiveBucket = z.infer<
  typeof universalDesignResponsiveBucketSchema
>;

export const normalizedColorSchema = z
  .object({
    hex: z.string().optional(),
    rgb: z.string().optional(),
    opacity: z.number().min(0).max(MAX_COLOR_OPACITY).optional(),
    css: z.string().optional(),
  })
  .passthrough();

export type NormalizedColor = z.infer<typeof normalizedColorSchema>;

export const normalizedLengthSchema = z
  .object({
    value: z.number(),
    unit: z.enum(["px", "%", "rem", "em", "vw", "vh"]),
  })
  .passthrough();

export type NormalizedLength = z.infer<typeof normalizedLengthSchema>;

export const normalizedTypographySchema = z
  .object({
    fontFamily: z.string().optional(),
    fontSize: normalizedLengthSchema.optional(),
    fontWeight: z.union([z.number(), z.string()]).optional(),
    lineHeight: z.union([z.number(), z.string()]).optional(),
    letterSpacing: normalizedLengthSchema.optional(),
    textAlign: z.string().optional(),
    color: normalizedColorSchema.optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    fontStyle: z.string().optional(),
    textDecoration: z.string().optional(),
  })
  .passthrough();

export type NormalizedTypography = z.infer<typeof normalizedTypographySchema>;

export const universalDesignLayerSchema = z
  .object({
    typography: normalizedTypographySchema.optional(),
    colors: z
      .object({
        text: normalizedColorSchema.optional(),
        background: normalizedColorSchema.optional(),
        border: normalizedColorSchema.optional(),
      })
      .passthrough()
      .optional(),
    spacing: z
      .object({
        paddingTop: normalizedLengthSchema.optional(),
        paddingRight: normalizedLengthSchema.optional(),
        paddingBottom: normalizedLengthSchema.optional(),
        paddingLeft: normalizedLengthSchema.optional(),
        marginTop: normalizedLengthSchema.optional(),
        marginRight: normalizedLengthSchema.optional(),
        marginBottom: normalizedLengthSchema.optional(),
        marginLeft: normalizedLengthSchema.optional(),
        gap: normalizedLengthSchema.optional(),
      })
      .passthrough()
      .optional(),
    sizing: z
      .object({
        width: normalizedLengthSchema.optional(),
        maxWidth: normalizedLengthSchema.optional(),
        minWidth: normalizedLengthSchema.optional(),
        height: normalizedLengthSchema.optional(),
        maxHeight: normalizedLengthSchema.optional(),
        minHeight: normalizedLengthSchema.optional(),
      })
      .passthrough()
      .optional(),
    borders: z
      .object({
        radius: normalizedLengthSchema.optional(),
        width: normalizedLengthSchema.optional(),
        color: normalizedColorSchema.optional(),
      })
      .passthrough()
      .optional(),
    shadows: z.object({ boxShadow: z.string().optional() }).passthrough().optional(),
    layout: z
      .object({
        display: z.string().optional(),
        flexDirection: z.string().optional(),
        justifyContent: z.string().optional(),
        alignItems: z.string().optional(),
        alignContent: z.string().optional(),
        textAlign: z.string().optional(),
        columns: z.number().optional(),
      })
      .passthrough()
      .optional(),
    visibility: z
      .object({
        hiddenDesktop: z.boolean().optional(),
        hiddenTablet: z.boolean().optional(),
        hiddenMobile: z.boolean().optional(),
        zIndex: z.number().optional(),
      })
      .passthrough()
      .optional(),
    /** Inert HubSpot/source CSS snippets — never applied via StyleModel.customCss in H1/H2 resolver. */
    effects: z
      .object({
        opacity: z.number().optional(),
        rawCss: z.string().optional(),
      })
      .passthrough()
      .optional(),
    extensions: z
      .object({
        themeClassNames: z.array(z.string()).optional(),
        appearancePreset: z.string().optional(),
        motion: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type UniversalDesignLayer = z.infer<typeof universalDesignLayerSchema>;

export const universalDesignUnresolvedSchema = z.object({
  code: z.string(),
  message: z.string(),
  detail: z.string().optional(),
});

export type UniversalDesignUnresolved = z.infer<typeof universalDesignUnresolvedSchema>;

export const universalDesignDataSchema = z.object({
  version: z.literal(UNIVERSAL_DESIGN_DATA_VERSION),
  role: z.string(),
  desktop: universalDesignLayerSchema,
  responsive: z
    .record(universalDesignResponsiveBucketSchema, universalDesignLayerSchema)
    .optional(),
  unresolved: z.array(universalDesignUnresolvedSchema).optional(),
});

export type UniversalDesignData = z.infer<typeof universalDesignDataSchema>;

export interface UniversalDesignEntry {
  role: string;
  data: UniversalDesignData;
}

/** Stable H2 identity: `${sourcePath}::${entryKey}` (entryKey is connector-local). */
export interface PageDesignEntryRef {
  entryKey: string;
  role: string;
  data: UniversalDesignData;
}

export interface PageDesignNodeRef {
  sourcePath: string;
  nodeId: string;
  parentNodeId?: string;
  nodeKind: string;
  designs: PageDesignEntryRef[];
  resolved: Array<ResolvedUniversalDesign & { entryKey: string }>;
  losslessSlices: Array<{ locator: string; raw: unknown }>;
}

/** Aggregated literals from an import batch — Phase J may persist; H1 builds in memory only. */
export interface SiteDesignProfile {
  version: typeof UNIVERSAL_DESIGN_DATA_VERSION;
  colors: string[];
  fontFamilies: string[];
  themeClassNames: string[];
}

export interface ResolvedUniversalDesign {
  role: string;
  styleModel: StyleModel;
  unresolved: UniversalDesignUnresolved[];
}

/** H2 consumption contract — no raw HubSpot payload required if this bundle is present. */
export interface PageDesignContract {
  version: typeof UNIVERSAL_DESIGN_DATA_VERSION;
  nodes: PageDesignNodeRef[];
  profile: SiteDesignProfile;
  diagnostics: DesignExtractionDiagnostic[];
}

export interface DesignExtractionDiagnostic {
  code: string;
  severity: "info" | "warning";
  message: string;
  sourcePath?: string;
  locator?: string;
}
