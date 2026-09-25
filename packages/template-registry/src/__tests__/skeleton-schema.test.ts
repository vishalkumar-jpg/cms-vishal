import { describe, expect, test } from "bun:test";
import {
  SKELETON_CONTENT_SCHEMA_VERSION,
  TemplateSkeletonValidationError,
  createTemplateSkeletonInputSchema,
  parseCreateTemplateSkeletonInput,
  parseUpdateTemplateSkeletonInput,
  templateSkeletonContentSchema,
} from "../skeleton-schema";

const validLayout = {
  schemaVersion: "2.0",
  root: "ROOT",
  nodes: {
    ROOT: {
      type: { resolvedName: "Section" },
      isCanvas: true,
      props: {},
      parent: null,
      nodes: [],
    },
  },
};

const validCreateInput = {
  templateKey: "tpl-test-page",
  displayName: "Test Page",
  description: "A test starter template",
  category: "marketing",
  supportedPageTypes: ["landing"],
  tags: ["test"],
  version: "1.0.0",
  status: "draft",
  schemaVersion: SKELETON_CONTENT_SCHEMA_VERSION,
  content: {
    contentSchemaVersion: SKELETON_CONTENT_SCHEMA_VERSION,
    layout: validLayout,
    sections: [
      {
        id: "hero",
        label: "Hero",
        required: true,
        optional: false,
        defaultEnabled: true,
        order: 0,
      },
    ],
    pageStructure: {
      defaultSectionOrder: ["hero"],
      requiredSectionIds: ["hero"],
      optionalSectionIds: [],
    },
    componentProps: {},
  },
};

describe("template skeleton schema", () => {
  test("accepts valid create input", () => {
    const parsed = parseCreateTemplateSkeletonInput(validCreateInput);
    expect(parsed.templateKey).toBe("tpl-test-page");
    expect(parsed.content.layout).toEqual(validLayout);
  });

  test("omitted previewMetadata parses to empty object", () => {
    const { previewMetadata: _omit, ...withoutPreview } = validCreateInput;
    const parsed = parseCreateTemplateSkeletonInput(withoutPreview);
    expect(parsed.previewMetadata).toEqual({});
  });

  test("rejects section that is both required and optional", () => {
    const input = {
      ...validCreateInput,
      content: {
        ...validCreateInput.content,
        sections: [
          {
            id: "hero",
            label: "Hero",
            required: true,
            optional: true,
            defaultEnabled: true,
            order: 0,
          },
        ],
      },
    };
    expect(() => parseCreateTemplateSkeletonInput(input)).toThrow(TemplateSkeletonValidationError);
  });

  test("rejects section that is neither required nor optional", () => {
    const input = {
      ...validCreateInput,
      content: {
        ...validCreateInput.content,
        sections: [
          {
            id: "hero",
            label: "Hero",
            required: false,
            optional: false,
            defaultEnabled: true,
            order: 0,
          },
        ],
      },
    };
    expect(() => parseCreateTemplateSkeletonInput(input)).toThrow(TemplateSkeletonValidationError);
  });

  test("rejects pageStructure ids not present in sections", () => {
    const input = {
      ...validCreateInput,
      content: {
        ...validCreateInput.content,
        pageStructure: {
          defaultSectionOrder: ["missing"],
          requiredSectionIds: ["hero"],
          optionalSectionIds: [],
        },
      },
    };
    expect(() => parseCreateTemplateSkeletonInput(input)).toThrow(TemplateSkeletonValidationError);
  });

  test("rejects overlap between requiredSectionIds and optionalSectionIds", () => {
    const input = {
      ...validCreateInput,
      content: {
        ...validCreateInput.content,
        pageStructure: {
          defaultSectionOrder: ["hero"],
          requiredSectionIds: ["hero"],
          optionalSectionIds: ["hero"],
        },
      },
    };
    expect(() => parseCreateTemplateSkeletonInput(input)).toThrow(TemplateSkeletonValidationError);
  });

  test("rejects duplicate section ids", () => {
    const input = {
      ...validCreateInput,
      content: {
        ...validCreateInput.content,
        sections: [
          validCreateInput.content.sections[0],
          {
            id: "footer",
            label: "Footer",
            required: false,
            optional: true,
            defaultEnabled: true,
            order: 1,
          },
          { ...validCreateInput.content.sections[0] },
        ],
        pageStructure: {
          defaultSectionOrder: ["hero", "footer", "hero"],
          requiredSectionIds: ["hero"],
          optionalSectionIds: ["footer"],
        },
      },
    };
    expect(() => parseCreateTemplateSkeletonInput(input)).toThrow(TemplateSkeletonValidationError);
  });

  test("rejects required section missing from requiredSectionIds", () => {
    const input = {
      ...validCreateInput,
      content: {
        ...validCreateInput.content,
        pageStructure: {
          defaultSectionOrder: ["hero"],
          requiredSectionIds: [],
          optionalSectionIds: [],
        },
      },
    };
    expect(() => parseCreateTemplateSkeletonInput(input)).toThrow(TemplateSkeletonValidationError);
  });

  test("rejects optional section missing from optionalSectionIds", () => {
    const input = {
      ...validCreateInput,
      content: {
        ...validCreateInput.content,
        sections: [
          {
            id: "hero",
            label: "Hero",
            required: false,
            optional: true,
            defaultEnabled: true,
            order: 0,
          },
        ],
        pageStructure: {
          defaultSectionOrder: ["hero"],
          requiredSectionIds: [],
          optionalSectionIds: [],
        },
      },
    };
    expect(() => parseCreateTemplateSkeletonInput(input)).toThrow(TemplateSkeletonValidationError);
  });

  test("rejects required section listed in optionalSectionIds", () => {
    const input = {
      ...validCreateInput,
      content: {
        ...validCreateInput.content,
        pageStructure: {
          defaultSectionOrder: ["hero"],
          requiredSectionIds: ["hero"],
          optionalSectionIds: ["hero"],
        },
      },
    };
    expect(() => parseCreateTemplateSkeletonInput(input)).toThrow(TemplateSkeletonValidationError);
  });

  test("rejects optional section listed in requiredSectionIds", () => {
    const input = {
      ...validCreateInput,
      content: {
        ...validCreateInput.content,
        sections: [
          {
            id: "hero",
            label: "Hero",
            required: false,
            optional: true,
            defaultEnabled: true,
            order: 0,
          },
        ],
        pageStructure: {
          defaultSectionOrder: ["hero"],
          requiredSectionIds: ["hero"],
          optionalSectionIds: [],
        },
      },
    };
    expect(() => parseCreateTemplateSkeletonInput(input)).toThrow(TemplateSkeletonValidationError);
  });

  test("rejects invalid template key", () => {
    expect(() =>
      parseCreateTemplateSkeletonInput({ ...validCreateInput, templateKey: "homepage" }),
    ).toThrow(TemplateSkeletonValidationError);
  });

  test("rejects missing supported page types", () => {
    expect(() =>
      parseCreateTemplateSkeletonInput({ ...validCreateInput, supportedPageTypes: [] }),
    ).toThrow(TemplateSkeletonValidationError);
  });

  test("rejects invalid category", () => {
    expect(() =>
      parseCreateTemplateSkeletonInput({ ...validCreateInput, category: "unknown" }),
    ).toThrow(TemplateSkeletonValidationError);
  });

  test("rejects skeleton section without label", () => {
    const input = {
      ...validCreateInput,
      content: {
        ...validCreateInput.content,
        sections: [{ ...validCreateInput.content.sections[0], label: "" }],
      },
    };
    expect(() => parseCreateTemplateSkeletonInput(input)).toThrow(TemplateSkeletonValidationError);
  });

  test("rejects unknown fields (strict mode)", () => {
    expect(() =>
      createTemplateSkeletonInputSchema.parse({ ...validCreateInput, extra: true }),
    ).toThrow();
  });

  test("update requires at least metadata or content", () => {
    expect(() => parseUpdateTemplateSkeletonInput({})).toThrow(TemplateSkeletonValidationError);
  });

  test("update accepts metadata-only patch", () => {
    const parsed = parseUpdateTemplateSkeletonInput({
      metadata: { displayName: "Renamed" },
    });
    expect(parsed.metadata?.displayName).toBe("Renamed");
  });

  test("content schema defaults pageStructure and componentProps", () => {
    const parsed = templateSkeletonContentSchema.parse({
      layout: validLayout,
    });
    expect(parsed.pageStructure.defaultSectionOrder).toEqual([]);
    expect(parsed.componentProps).toEqual({});
    expect(parsed.contentSchemaVersion).toBe(SKELETON_CONTENT_SCHEMA_VERSION);
  });
});
