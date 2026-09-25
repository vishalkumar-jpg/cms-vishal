import { describe, expect, it } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImportActivitySection } from "../components/ImportActivitySection";
import type { ImportRun } from "../types";

const baseRun: Omit<ImportRun, "resultSummary"> = {
  runId: "imr_test",
  connectionId: "ccn_test",
  connectorId: "hubspot",
  connectorName: "HubSpot",
  accountId: "51993961",
  accountLabel: "app.hubspot.com",
  scope: "published",
  status: "succeeded",
  startedAt: "2026-09-15T10:00:00.000Z",
  completedAt: "2026-09-15T10:05:00.000Z",
  errorMessage: null,
};

describe("ImportActivitySection", () => {
  it("renders import run rows with formatted imported counts", () => {
    const run: ImportRun = {
      ...baseRun,
      resultSummary: { importedPages: 2, importedPosts: 1, skipped: [] },
    };
    const html = renderToStaticMarkup(
      <ImportActivitySection runs={[run]} isLoading={false} isError={false} />,
    );
    expect(html.includes("HubSpot")).toBe(true);
    expect(html.includes("succeeded")).toBe(true);
    expect(html.includes("2 pages imported, 1 post imported")).toBe(true);
  });

  it("renders re-import results with updated counts and skipped items", () => {
    const run: ImportRun = {
      ...baseRun,
      resultSummary: {
        importedPages: 0,
        importedPosts: 0,
        updatedPages: 2,
        updatedPosts: 0,
        skipped: [{ name: "page:1", reason: "slug" }],
      },
    };
    const html = renderToStaticMarkup(
      <ImportActivitySection runs={[run]} isLoading={false} isError={false} />,
    );
    expect(html.includes("2 pages updated, 0 posts (1 item skipped)")).toBe(true);
  });

  it("shows empty state when there are no runs", () => {
    const html = renderToStaticMarkup(
      <ImportActivitySection runs={[]} isLoading={false} isError={false} />,
    );
    expect(html.includes("No import runs yet")).toBe(true);
  });
});
