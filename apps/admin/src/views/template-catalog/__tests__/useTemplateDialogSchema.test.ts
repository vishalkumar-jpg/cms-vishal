import { describe, expect, it } from "bun:test";
import { useTemplateDialogSchema } from "../components/UseTemplateDialog";

describe("useTemplateDialogSchema", () => {
  it("rejects whitespace-only titles", () => {
    const result = useTemplateDialogSchema.safeParse({ title: "   ", slug: "home" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.title?.[0]).toBe("Title is required");
    }
  });

  it("accepts titles after trimming", () => {
    const result = useTemplateDialogSchema.safeParse({
      title: "  Home Page  ",
      slug: "home-page",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Home Page");
    }
  });

  it("rejects slugs that start or end with a hyphen", () => {
    expect(useTemplateDialogSchema.safeParse({ title: "Home", slug: "-home" }).success).toBe(
      false,
    );
    expect(useTemplateDialogSchema.safeParse({ title: "Home", slug: "home-" }).success).toBe(
      false,
    );
    expect(useTemplateDialogSchema.safeParse({ title: "Home", slug: "-" }).success).toBe(false);
  });

  it("lowercases slugs to match API Transform(lower)", () => {
    const result = useTemplateDialogSchema.safeParse({ title: "Home", slug: "Home-Page" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe("home-page");
    }
  });

  it("rejects reserved root slugs", () => {
    expect(useTemplateDialogSchema.safeParse({ title: "Blog", slug: "blog" }).success).toBe(
      false,
    );
  });

  it("rejects titles longer than 300 characters", () => {
    const result = useTemplateDialogSchema.safeParse({
      title: "x".repeat(301),
      slug: "home",
    });
    expect(result.success).toBe(false);
  });
});
