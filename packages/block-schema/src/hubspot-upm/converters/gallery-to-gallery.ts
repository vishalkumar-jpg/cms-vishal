import {
  isNonEmptyParamValue,
  isPlainObject,
  topLevelParamsOnlyAllowNonEmpty,
} from "../convert-module-params";
import { HUBSPOT_GALLERY_PARAM_KEY } from "../complex-module-param-keys";
import {
  HUBSPOT_PIKE_MODULE_METADATA_WITH_STYLE_KEYS,
  hubspotModulePathEndsWith,
} from "./hubspot-pike-module-metadata";

export { HUBSPOT_GALLERY_PARAM_KEY };

export const HUBSPOT_IMAGE_GALLERY_PATH_SUFFIX = "modules/image-gallery";

export interface GalleryBlockProps {
  images: Array<{ imageUrl: string; caption?: string }>;
  lightbox?: boolean;
}

const GALLERY_ALLOWED_TOP_LEVEL_KEYS = [
  ...HUBSPOT_PIKE_MODULE_METADATA_WITH_STYLE_KEYS,
  HUBSPOT_GALLERY_PARAM_KEY,
  "data_source",
  "skin",
  "lightbox",
] as const;

const mapGalleryItem = (item: unknown): GalleryBlockProps["images"][number] | null => {
  if (!isPlainObject(item)) return null;
  for (const key of Object.keys(item)) {
    if (key !== "caption" && key !== "image" && isNonEmptyParamValue(item[key])) return null;
  }
  if (item.caption !== undefined && item.caption !== null && typeof item.caption !== "string") {
    return null;
  }
  const image = item.image;
  if (!isPlainObject(image)) return null;
  for (const key of Object.keys(image)) {
    if (key !== "src" && isNonEmptyParamValue(image[key])) return null;
  }
  if (typeof image.src !== "string" || !image.src.trim()) return null;

  const caption =
    typeof item.caption === "string" && item.caption.trim().length > 0
      ? item.caption.trim()
      : undefined;

  return caption
    ? { imageUrl: image.src.trim(), caption }
    : { imageUrl: image.src.trim() };
};

export const moduleParamsIncludePikeGallery = (params: Record<string, unknown>): boolean => {
  if (!(HUBSPOT_GALLERY_PARAM_KEY in params) || !Array.isArray(params[HUBSPOT_GALLERY_PARAM_KEY])) {
    return false;
  }
  return hubspotModulePathEndsWith(params.path, HUBSPOT_IMAGE_GALLERY_PATH_SUFFIX);
};

export const tryMapPikeGalleryParamsToGalleryProps = (
  params: Record<string, unknown>,
): GalleryBlockProps | null => {
  if (!moduleParamsIncludePikeGallery(params)) return null;
  if (!topLevelParamsOnlyAllowNonEmpty(params, GALLERY_ALLOWED_TOP_LEVEL_KEYS)) {
    return null;
  }

  const gallery = params[HUBSPOT_GALLERY_PARAM_KEY];
  if (!Array.isArray(gallery) || gallery.length === 0) return null;

  const images: GalleryBlockProps["images"] = [];
  for (const item of gallery) {
    const mapped = mapGalleryItem(item);
    if (!mapped) return null;
    images.push(mapped);
  }

  const lightboxValue = params.lightbox;
  if (
    lightboxValue !== undefined &&
    lightboxValue !== null &&
    typeof lightboxValue !== "boolean"
  ) {
    return null;
  }

  return {
    images,
    ...(lightboxValue === true || lightboxValue === false ? { lightbox: lightboxValue } : {}),
  };
};
