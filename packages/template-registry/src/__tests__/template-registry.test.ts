import { describe, expect, jest, test } from "bun:test";
import { utcMillis } from "@ob-cms/shared";
import {
  BUILTIN_TEMPLATE_IDS,
  TemplateRegistryError,
  createBuiltinTemplateRegistry,
  createTemplateRegistry,
  templateMetadataSchema,
  templateStatusSchema,
} from "../index";

describe("template-registry", () => {
  test("registers and looks up a template by id", () => {
    const registry = createTemplateRegistry();
    const entry = registry.register({
      id: "tpl-test-sample",
      displayName: "Sample",
      description: "A sample template",
      category: "marketing",
      supportedPageTypes: ["sample"],
      tags: ["test"],
      version: "1.0.0",
      status: "draft",
    });

    expect(entry.id).toBe("tpl-test-sample");
    expect(entry.createdAt).toBeTruthy();
    expect(entry.updatedAt).toBeTruthy();
    expect(registry.getById("tpl-test-sample")).toEqual(entry);
    expect(registry.requireById("tpl-test-sample").displayName).toBe("Sample");
  });

  test("rejects duplicate template ids", () => {
    const registry = createTemplateRegistry();
    const seed = {
      id: "tpl-dup",
      displayName: "Dup",
      description: "First",
      category: "utility" as const,
      supportedPageTypes: ["x"],
      tags: [],
      version: "1.0.0",
      status: "draft" as const,
    };
    registry.register(seed);
    expect(() => registry.register({ ...seed, description: "Second" })).toThrow(
      TemplateRegistryError,
    );
    try {
      registry.register({ ...seed, description: "Second" });
    } catch (err) {
      expect(err).toBeInstanceOf(TemplateRegistryError);
      expect((err as TemplateRegistryError).code).toBe("DUPLICATE_ID");
    }
  });

  test("rejects invalid metadata and unsupported status", () => {
    const registry = createTemplateRegistry();
    expect(() =>
      registry.register({
        id: "bad-id",
        displayName: "Bad",
        description: "Missing tpl- prefix",
        category: "marketing",
        supportedPageTypes: ["x"],
        tags: [],
        version: "1.0.0",
        status: "draft",
      }),
    ).toThrow(TemplateRegistryError);

    expect(templateStatusSchema.safeParse("deprecated").success).toBe(false);
    expect(() =>
      registry.register({
        id: "tpl-ok",
        displayName: "Ok",
        description: "Has bad status",
        category: "marketing",
        supportedPageTypes: ["x"],
        tags: [],
        version: "1.0.0",
        // @ts-expect-error intentional invalid status
        status: "deprecated",
      }),
    ).toThrow(TemplateRegistryError);
  });

  test("builtin catalog has 28 starters and unique ids", () => {
    const registry = createBuiltinTemplateRegistry();
    expect(registry.size()).toBe(28);
    expect(new Set(BUILTIN_TEMPLATE_IDS).size).toBe(28);
    
    // Collect all IDs from the registry
    const registryIds = registry.list().map((t) => t.id);
    
    // Compare against exported builtin catalog IDs (order-independent)
    expect(new Set(registryIds)).toEqual(new Set(BUILTIN_TEMPLATE_IDS));
    
    expect(registry.getById("tpl-homepage")?.status).toBe("published");
    expect(registry.getById("tpl-service-detail")?.category).toBe("marketing");
  });

  test("lists and filters by category, status, and page type", () => {
    const registry = createBuiltinTemplateRegistry();

    const marketing = registry.listByCategory("marketing");
    expect(marketing.length).toBeGreaterThan(0);
    expect(marketing.every((t) => t.category === "marketing")).toBe(true);

    const published = registry.listByStatus("published");
    expect(published.length).toBe(28);

    const services = registry.listByPageType("service-detail");
    expect(services.map((t) => t.id)).toEqual(["tpl-service-detail"]);

    const legal = registry.list({ category: "legal", status: "published" });
    expect(legal.map((t) => t.id).sort()).toEqual([
      "tpl-privacy-policy",
      "tpl-terms",
    ]);
  });

  test("filters by featured, tags, and search query", () => {
    const registry = createBuiltinTemplateRegistry();

    const featured = registry.list({ featured: true });
    expect(featured.every((t) => t.featured === true)).toBe(true);
    expect(featured.map((t) => t.id)).toContain("tpl-homepage");

    const withServices = registry.list({ tags: ["services"] });
    expect(withServices.map((t) => t.id).sort()).toEqual(
      expect.arrayContaining(["tpl-services", "tpl-service-detail", "tpl-contact"]),
    );

    const search = registry.list({ query: "landing" });
    expect(search.some((t) => t.id === "tpl-landing")).toBe(true);
  });

  test("schema parses a complete metadata object", () => {
    const parsed = templateMetadataSchema.parse({
      id: "tpl-parse-me",
      displayName: "Parse Me",
      description: "Validation sample",
      category: "content",
      supportedPageTypes: ["x"],
      tags: ["a"],
      thumbnail: "placeholder:tpl-parse-me",
      version: "1.2.3",
      status: "archived",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      featured: false,
    });
    expect(parsed.version).toBe("1.2.3");
    expect(parsed.status).toBe("archived");
  });

  test("schema rejects date-only values for timestamp fields", () => {
    const validBase = {
      id: "tpl-timestamp-test",
      displayName: "Timestamp Test",
      description: "Test timestamp validation",
      category: "marketing",
      supportedPageTypes: ["x"],
      tags: [],
      version: "1.0.0",
      status: "draft",
    };

    // Test createdAt rejects date-only string
    const resultCreatedAt = templateMetadataSchema.safeParse({
      ...validBase,
      createdAt: "2026-01-01",
    });
    expect(resultCreatedAt.success).toBe(false);

    // Test updatedAt rejects date-only string
    const resultUpdatedAt = templateMetadataSchema.safeParse({
      ...validBase,
      updatedAt: "2026-01-01",
    });
    expect(resultUpdatedAt.success).toBe(false);
  });

  test("requireById throws NOT_FOUND", () => {
    const registry = createTemplateRegistry();
    try {
      registry.requireById("tpl-missing");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(TemplateRegistryError);
      expect((err as TemplateRegistryError).code).toBe("NOT_FOUND");
    }
  });

  test("rejects empty fields, empty page types, and invalid category", () => {
    const registry = createTemplateRegistry();
    const base = {
      id: "tpl-edge",
      displayName: "Edge",
      description: "Edge cases",
      category: "marketing" as const,
      supportedPageTypes: ["ok"],
      tags: ["t"],
      version: "1.0.0",
      status: "draft" as const,
    };

    expect(() =>
      registry.register({ ...base, displayName: "" }),
    ).toThrow(TemplateRegistryError);

    expect(() =>
      registry.register({ ...base, supportedPageTypes: [] }),
    ).toThrow(TemplateRegistryError);

    expect(() =>
      registry.register({ ...base, tags: [""] }),
    ).toThrow(TemplateRegistryError);

    expect(() =>
      registry.register({
        ...base,
        // @ts-expect-error intentional invalid category
        category: "Marketing",
      }),
    ).toThrow(TemplateRegistryError);
  });

  test("list rejects invalid query filters with VALIDATION", () => {
    const registry = createBuiltinTemplateRegistry();
    try {
      registry.list({
        // @ts-expect-error intentional invalid status filter
        status: "deprecated",
      });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(TemplateRegistryError);
      expect((err as TemplateRegistryError).code).toBe("VALIDATION");
    }
  });

  test("registered entries are immutable", () => {
    const registry = createTemplateRegistry();
    const entry = registry.register({
      id: "tpl-frozen",
      displayName: "Frozen",
      description: "Cannot mutate",
      category: "utility",
      supportedPageTypes: ["x"],
      tags: ["a"],
      version: "1.0.0",
      status: "draft",
    });
    expect(() => {
      // @ts-expect-error intentional mutation attempt
      entry.displayName = "Hacked";
    }).toThrow();
    expect(() => entry.tags.push("hacked")).toThrow();
    expect(() => entry.supportedPageTypes.push("hacked")).toThrow();
    expect(registry.getById("tpl-frozen")?.displayName).toBe("Frozen");
  });

  test("updates an existing template", () => {
    const registry = createTemplateRegistry();
    registry.register({
      id: "tpl-update",
      displayName: "Initial",
      description: "Desc",
      category: "marketing",
      supportedPageTypes: ["x"],
      tags: [],
      version: "1.0.0",
      status: "draft",
    });

    const updated = registry.update("tpl-update", {
      displayName: "Updated",
    });

    expect(updated.displayName).toBe("Updated");
    expect(updated.version).toBe("1.0.0"); // Remains unchanged
    
    const fetched = registry.requireById("tpl-update");
    expect(fetched.displayName).toBe("Updated");
  });

  test("update refreshes updatedAt and does not alter createdAt", () => {
    jest.useFakeTimers();
    try {
      const registry = createTemplateRegistry();
      const mockNow = "2026-01-01T00:00:00.000Z";
      const futureUpdatedAt = "2099-06-15T12:00:00.000Z";

      jest.setSystemTime(utcMillis(mockNow));

      registry.register({
        id: "tpl-refresh",
        displayName: "Refresh",
        description: "Desc",
        category: "marketing",
        supportedPageTypes: ["x"],
        tags: [],
        version: "1.0.0",
        status: "draft",
        createdAt: futureUpdatedAt,
        updatedAt: futureUpdatedAt,
      });

      const first = registry.update("tpl-refresh", {
        displayName: "First",
      });

      const second = registry.update("tpl-refresh", {
        displayName: "Second",
      });

      expect(first.createdAt).toBe(futureUpdatedAt);
      expect(second.createdAt).toBe(futureUpdatedAt);

      expect(utcMillis(first.updatedAt)).toBeGreaterThan(
        utcMillis(futureUpdatedAt),
      );
      expect(utcMillis(second.updatedAt)).toBeGreaterThan(
        utcMillis(first.updatedAt),
      );

      // Clock is behind stored updatedAt; bump must still be strictly monotonic.
      expect(utcMillis(first.updatedAt)).toBeGreaterThan(
        utcMillis(mockNow),
      );
    } finally {
      jest.useRealTimers();
    }
  });
  test("update with system-managed fields throws validation error (immutable/system-managed fields)", () => {
    const registry = createTemplateRegistry();
    registry.register({
      id: "tpl-immutable",
      displayName: "Immutable",
      description: "Desc",
      category: "marketing",
      supportedPageTypes: ["x"],
      tags: [],
      version: "1.0.0",
      status: "draft",
    });

    // @ts-expect-error intentional testing of invalid property
    expect(() => registry.update("tpl-immutable", { id: "new-id" })).toThrow(TemplateRegistryError);
    // @ts-expect-error intentional
    expect(() => registry.update("tpl-immutable", { createdAt: "2026-01-01T00:00:00.000Z" })).toThrow(TemplateRegistryError);
    // @ts-expect-error intentional
    expect(() => registry.update("tpl-immutable", { updatedAt: "2026-01-01T00:00:00.000Z" })).toThrow(TemplateRegistryError);
    // @ts-expect-error intentional
    expect(() => registry.update("tpl-immutable", { version: "2.0.0" })).toThrow(TemplateRegistryError);
    // @ts-expect-error intentional
    expect(() => registry.update("tpl-immutable", { status: "published" })).toThrow(TemplateRegistryError);
  });

  test("update throws on invalid data or missing template", () => {
    const registry = createTemplateRegistry();
  
    registry.register({
      id: "tpl-bad-update",
      displayName: "Initial",
      description: "Desc",
      category: "marketing",
      supportedPageTypes: ["x"],
      tags: [],
      version: "1.0.0",
      status: "draft",
    });
  
    try {
      registry.update("tpl-bad-update", { displayName: "" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(TemplateRegistryError);
      expect((err as TemplateRegistryError).code).toBe("VALIDATION");
    }
  
    try {
      registry.update("tpl-missing", { displayName: "Hi" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(TemplateRegistryError);
      expect((err as TemplateRegistryError).code).toBe("NOT_FOUND");
    }
  });


  test("archive and publish update the status", () => {
    const registry = createTemplateRegistry();
    registry.register({
      id: "tpl-lifecycle",
      displayName: "Lifecycle",
      description: "Desc",
      category: "marketing",
      supportedPageTypes: ["x"],
      tags: [],
      version: "1.0.0",
      status: "draft",
    });

    const published = registry.publish("tpl-lifecycle");
    expect(published.status).toBe("published");
    expect(registry.requireById("tpl-lifecycle").status).toBe("published");

    const archived = registry.archive("tpl-lifecycle");
    expect(archived.status).toBe("archived");
    expect(registry.requireById("tpl-lifecycle").status).toBe("archived");
  });
});