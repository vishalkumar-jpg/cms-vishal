import { describe, expect, test } from "bun:test";
import {
  TemplateSkeletonAssetValidationError,
  parseCreateTemplateSkeletonAssetInput,
  parseUpdateTemplateSkeletonAssetInput,
} from "../asset-schema";

describe("template skeleton asset schema", () => {
  test("accepts valid create input", () => {
    const parsed = parseCreateTemplateSkeletonAssetInput({
      assetType: "thumbnail",
      url: "https://cdn.example.com/thumb.webp",
      mimeType: "image/webp",
      width: 400,
      height: 300,
      size: 12000,
      altText: "Homepage thumbnail",
    });
    expect(parsed.assetType).toBe("thumbnail");
    expect(parsed.url).toContain("https://");
  });

  test("accepts site-relative url", () => {
    const parsed = parseCreateTemplateSkeletonAssetInput({
      assetType: "icon",
      url: "/assets/templates/icon.svg",
    });
    expect(parsed.url).toBe("/assets/templates/icon.svg");
  });

  test("accepts root-relative image path", () => {
    const parsed = parseCreateTemplateSkeletonAssetInput({
      assetType: "gallery_image",
      url: "/image.png",
    });
    expect(parsed.url).toBe("/image.png");
  });

  test("rejects invalid asset type", () => {
    expect(() =>
      parseCreateTemplateSkeletonAssetInput({
        assetType: "banner",
        url: "https://example.com/x.png",
      }),
    ).toThrow(TemplateSkeletonAssetValidationError);
  });

  test("rejects invalid url", () => {
    expect(() =>
      parseCreateTemplateSkeletonAssetInput({
        assetType: "thumbnail",
        url: "not-a-url",
      }),
    ).toThrow(TemplateSkeletonAssetValidationError);
  });

  test("rejects protocol-relative url", () => {
    expect(() =>
      parseCreateTemplateSkeletonAssetInput({
        assetType: "thumbnail",
        url: "//evil.com/image.png",
      }),
    ).toThrow(TemplateSkeletonAssetValidationError);
  });

  test("rejects backslash-normalized relative url", () => {
    expect(() =>
      parseCreateTemplateSkeletonAssetInput({
        assetType: "thumbnail",
        url: "/\\evil.com/image.png",
      }),
    ).toThrow(TemplateSkeletonAssetValidationError);
  });

  test.each([
    ["tab", "/\t/evil.com/image.png"],
    ["newline", "/\n/evil.com/image.png"],
    ["carriage return", "/\r/evil.com/image.png"],
    ["tab then backslash", "/\t\\evil.com/image.png"],
  ] as const)("rejects %s-normalized relative url", (_label, url) => {
    expect(() =>
      parseCreateTemplateSkeletonAssetInput({
        assetType: "thumbnail",
        url,
      }),
    ).toThrow(TemplateSkeletonAssetValidationError);
  });

  test("rejects absolute url with embedded control character", () => {
    expect(() =>
      parseCreateTemplateSkeletonAssetInput({
        assetType: "thumbnail",
        url: "https://cdn.example.com/image\t.png",
      }),
    ).toThrow(TemplateSkeletonAssetValidationError);
  });

  test("rejects image mime on video_preview", () => {
    expect(() =>
      parseCreateTemplateSkeletonAssetInput({
        assetType: "video_preview",
        url: "https://example.com/preview.mp4",
        mimeType: "image/png",
      }),
    ).toThrow(TemplateSkeletonAssetValidationError);
  });

  test("accepts video mime on video_preview", () => {
    const parsed = parseCreateTemplateSkeletonAssetInput({
      assetType: "video_preview",
      url: "https://example.com/preview.mp4",
      mimeType: "video/mp4",
    });
    expect(parsed.mimeType).toBe("video/mp4");
  });

  test("accepts case-insensitive mpegurl mime on video_preview", () => {
    const parsed = parseCreateTemplateSkeletonAssetInput({
      assetType: "video_preview",
      url: "https://example.com/preview.m3u8",
      mimeType: "APPLICATION/X-MPEGURL",
    });
    expect(parsed.mimeType).toBe("APPLICATION/X-MPEGURL");
  });

  test("rejects unknown fields in strict mode", () => {
    expect(() =>
      parseCreateTemplateSkeletonAssetInput({
        assetType: "gallery_image",
        url: "https://example.com/1.png",
        extra: true,
      }),
    ).toThrow(TemplateSkeletonAssetValidationError);
  });

  test("update requires at least one field", () => {
    expect(() => parseUpdateTemplateSkeletonAssetInput({})).toThrow(
      TemplateSkeletonAssetValidationError,
    );
  });

  test("update accepts metadata patch", () => {
    const parsed = parseUpdateTemplateSkeletonAssetInput({
      altText: "Updated alt",
      sortOrder: 2,
    });
    expect(parsed.altText).toBe("Updated alt");
    expect(parsed.sortOrder).toBe(2);
  });
});
