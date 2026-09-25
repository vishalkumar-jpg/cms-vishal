import { describe, expect, test } from "bun:test";
import {
  COMPONENT_FAMILIES,
  COMPONENT_FAMILY_IDS,
  COMPONENT_FAMILY_LIST,
  HERO_VARIANTS,
  familiesForRegistryName,
  getComponentFamily,
} from "../index";

describe("component-families catalog", () => {
  test("every family id has a definition", () => {
    for (const id of COMPONENT_FAMILY_IDS) {
      expect(COMPONENT_FAMILIES[id].id).toBe(id);
    }
    expect(COMPONENT_FAMILY_LIST).toHaveLength(COMPONENT_FAMILY_IDS.length);
  });

  test("hero family declares required product variants", () => {
    const hero = getComponentFamily("hero");
    for (const v of HERO_VARIANTS) {
      expect(hero.config.variants).toContain(v);
    }
    expect(hero.registryNames).toContain("Hero Section");
    expect(hero.config.fields).toContain("variant");
  });

  test("required PR #3 families expose config contracts", () => {
    const required = [
      "hero",
      "cta",
      "cards",
      "testimonials",
      "faq",
      "team",
      "timeline",
      "forms",
    ] as const;
    for (const id of required) {
      const family = getComponentFamily(id);
      expect(family.config.fields.length).toBeGreaterThan(0);
      expect(family.label.length).toBeGreaterThan(0);
    }
  });

  test("testimonials and faq prefer reusable blocks", () => {
    expect(getComponentFamily("testimonials").preferReusableBlock).toBe(true);
    expect(getComponentFamily("faq").preferReusableBlock).toBe(true);
  });

  test("registry name maps back to families", () => {
    const heroes = familiesForRegistryName("Hero Section");
    expect(heroes.map((f) => f.id)).toEqual(["hero"]);
    expect(familiesForRegistryName("Accordion").map((f) => f.id)).toEqual([
      "faq",
    ]);
  });

  test("documented gaps have empty registry lists", () => {
    expect(getComponentFamily("roles-matrix").registryNames).toEqual([]);
    expect(getComponentFamily("related-links").registryNames).toEqual([]);
  });
});
