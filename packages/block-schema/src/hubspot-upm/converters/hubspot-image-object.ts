import { isNonEmptyParamValue, isPlainObject } from "../convert-module-params";

export interface HubspotMappedImageFields {
  imageUrl: string;
  altText?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
}

const isValidLoading = (value: unknown): value is "lazy" | "eager" | undefined => {
  if (value === undefined || value === null || value === "") return true;
  return value === "lazy" || value === "eager";
};

const isValidImageDimension = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return false;
  return true;
};

const readImageDimension = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return value;
};

/** Pike / linked_image image objects — only keys that map to OB Image without loss. */
export const readStrictHubspotImageObject = (
  value: unknown,
): HubspotMappedImageFields | null => {
  if (!isPlainObject(value)) return null;
  for (const key of Object.keys(value)) {
    if (
      key !== "src" &&
      key !== "alt" &&
      key !== "width" &&
      key !== "height" &&
      key !== "loading" &&
      isNonEmptyParamValue(value[key])
    ) {
      return null;
    }
  }
  if (typeof value.src !== "string" || !value.src.trim()) return null;
  if (value.alt !== undefined && value.alt !== null && typeof value.alt !== "string") return null;
  if (!isValidImageDimension(value.width)) return null;
  if (!isValidImageDimension(value.height)) return null;
  if (!isValidLoading(value.loading)) return null;

  const imageUrl = value.src.trim();
  const altText =
    typeof value.alt === "string" && value.alt.trim().length > 0 ? value.alt.trim() : undefined;
  const width = readImageDimension(value.width);
  const height = readImageDimension(value.height);
  const loading =
    value.loading === "lazy" || value.loading === "eager" ? value.loading : undefined;

  return {
    imageUrl,
    ...(altText ? { altText } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(loading ? { loading } : {}),
  };
};
