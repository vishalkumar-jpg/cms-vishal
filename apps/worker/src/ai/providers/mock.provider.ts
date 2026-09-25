import { CURRENT_SCHEMA_VERSION } from "@ob-cms/block-schema";
import type { AiGenerateInput, AiGenerateOutput, AiProvider } from "./types";

/**
 * Offline MOCK provider (AI_MOCK=true). Returns a small valid hero+features+CTA
 * SerializedLayout so the full generate→validate→repair→draft loop is testable
 * with no real API key. When AI_MOCK_BAD_FIRST=true it returns ONE invalid
 * layout (unknown block type) on the first call, then a valid one — exercising
 * the self-correction retry path. Call state is per-instance, so a fresh
 * provider is created per job.
 */
export class MockProvider implements AiProvider {
  readonly name = "mock" as const;
  private calls = 0;
  private readonly badFirst: boolean;

  constructor(badFirst = process.env.AI_MOCK_BAD_FIRST === "true") {
    this.badFirst = badFirst;
  }

  async generate(_input: AiGenerateInput): Promise<AiGenerateOutput> {
    this.calls += 1;
    const firstCall = this.calls === 1;
    const json = this.badFirst && firstCall ? badLayout() : goodLayout();
    return { json, tokensIn: 1200, tokensOut: 800 };
  }
}

/** Valid hero + features + CTA layout under a root Section. */
function goodLayout(): string {
  return JSON.stringify({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    root: "ROOT",
    nodes: {
      ROOT: {
        type: { resolvedName: "Section" },
        isCanvas: true,
        props: { sectionId: "page", styles: {} },
        displayName: "Section",
        parent: null,
        nodes: ["HERO", "FEATURES", "CTA"],
      },
      HERO: {
        type: { resolvedName: "Hero Section" },
        isCanvas: false,
        props: {
          title: "Build pages with AI",
          subtitle: "Describe what you want and ship a draft in seconds.",
          ctaText: "Get started",
          ctaUrl: "#",
          showCta: true,
        },
        displayName: "Hero Section",
        parent: "ROOT",
        nodes: [],
      },
      FEATURES: {
        type: { resolvedName: "Feature List" },
        isCanvas: false,
        props: {
          columns: 3,
          features: [
            { title: "Fast", description: "Generate in seconds." },
            { title: "On-brand", description: "Uses your theme tokens." },
            { title: "Safe", description: "Drafts only — you review." },
          ],
        },
        displayName: "Feature List",
        parent: "ROOT",
        nodes: [],
      },
      CTA: {
        type: { resolvedName: "Button" },
        isCanvas: false,
        props: { label: "Start now", url: "#", variant: "primary" },
        displayName: "Button",
        parent: "ROOT",
        nodes: [],
      },
    },
  });
}

/** Intentionally invalid: an unknown block type that repair would drop. */
function badLayout(): string {
  return JSON.stringify({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    root: "ROOT",
    nodes: {
      ROOT: {
        type: { resolvedName: "Section" },
        isCanvas: true,
        props: {},
        parent: null,
        nodes: ["BOGUS"],
      },
      BOGUS: {
        type: { resolvedName: "NotARealBlock" },
        isCanvas: false,
        props: { title: "oops" },
        parent: "ROOT",
        nodes: [],
      },
    },
  });
}
