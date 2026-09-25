import { describe, expect, it } from "bun:test";
import { copyTextToClipboard, starterTemplateMenuItems } from "../lib/catalogActions";

describe("starterTemplateMenuItems", () => {
  it("exposes read-only starter actions", () => {
    const items = starterTemplateMenuItems(true);
    expect(items.map((i) => i.action)).toEqual(["preview", "details", "use", "copyKey", "copyId"]);
    expect(items.every((i) => !i.disabled)).toBe(true);
  });

  it("disables Use when the starter cannot create a page", () => {
    const items = starterTemplateMenuItems(false);
    expect(items.find((i) => i.action === "use")?.disabled).toBe(true);
    expect(items.find((i) => i.action === "preview")?.disabled).toBe(undefined);
  });

  it("does not include edit, delete, or publish actions", () => {
    const labels = starterTemplateMenuItems(true).map((i) => i.label.toLowerCase());
    expect(labels.some((l) => l.includes("edit"))).toBe(false);
    expect(labels.some((l) => l.includes("delete"))).toBe(false);
    expect(labels.some((l) => l.includes("publish"))).toBe(false);
  });
});

describe("copyTextToClipboard", () => {
  const withNavigator = async (
    navigatorValue: unknown,
    run: () => Promise<void>,
  ): Promise<void> => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", {
      value: navigatorValue,
      configurable: true,
    });
    try {
      await run();
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, "navigator", originalDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "navigator");
      }
    }
  };

  it("returns true when clipboard write succeeds", async () => {
    let lastWritten: string | undefined;
    await withNavigator(
      {
        clipboard: {
          writeText: async (value: string) => {
            lastWritten = value;
          },
        },
      },
      async () => {
        expect(await copyTextToClipboard("tpl-blank")).toBe(true);
        expect(lastWritten).toBe("tpl-blank");
      },
    );
  });

  it("returns false when clipboard is unavailable", async () => {
    await withNavigator({}, async () => {
      expect(await copyTextToClipboard("tsk_1")).toBe(false);
    });
  });

  it("returns false when clipboard write throws", async () => {
    await withNavigator(
      {
        clipboard: {
          writeText: async () => {
            throw new Error("denied");
          },
        },
      },
      async () => {
        expect(await copyTextToClipboard("tpl-blank")).toBe(false);
      },
    );
  });
});
