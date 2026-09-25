import { describe, expect, it } from "bun:test";
import {
  formatStarterUsageLabel,
  formatStarterUsageTotal,
} from "../lib/formatTemplateUsage";

describe("formatTemplateUsage", () => {
  it("formatStarterUsageLabel returns null for zero or missing counts", () => {
    expect(formatStarterUsageLabel(undefined)).toEqual(null);
    expect(formatStarterUsageLabel(0)).toEqual(null);
  });

  it("formatStarterUsageLabel pluralizes page counts", () => {
    expect(formatStarterUsageLabel(1)).toBe("Used on 1 page");
    expect(formatStarterUsageLabel(18)).toBe("Used on 18 pages");
    expect(formatStarterUsageLabel(1234)).toBe(`Used on ${new Intl.NumberFormat(undefined).format(1234)} pages`);
  });

  it("formatStarterUsageTotal handles empty and plural totals", () => {
    expect(formatStarterUsageTotal(0)).toBe("No pages yet");
    expect(formatStarterUsageTotal(1)).toBe("1 page");
    expect(formatStarterUsageTotal(18)).toBe("18 pages");
    expect(formatStarterUsageTotal(1234)).toBe(`${new Intl.NumberFormat(undefined).format(1234)} pages`);
  });
});
