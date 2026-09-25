"use client";

import * as React from "react";
import { sanitizeText, sanitizeUrl, useMounted, resolveSurfaceStyles, styleModelHasVisualOverrides } from "../lib";

/**
 * ONSITE-SEARCH (#64) — a public site-search box.
 *
 * SSR / parity: the server (and the builder canvas) render a STATIC box that is
 * byte-identical everywhere. On the published site the block hydrates as a
 * "use client" island: submitting the box fetches the same-origin `/api/search`
 * proxy (which the renderer forwards to the host-resolved public API) and
 * renders a ranked results list with snippets + empty / no-results states.
 *
 * There is no live-vs-preview context: the fetch target is same-origin and only
 * runs after mount (`useMounted`), so the builder preview never queries and the
 * server output is stable (no hydration mismatch, no `window` at module load).
 * The `snippet` HTML is produced by Postgres `ts_headline` (only <mark> markup;
 * everything else HTML-escaped) so it is rendered as text-with-marks, not raw
 * HTML, avoiding any XSS surface.
 */

interface SearchBlockProps {
  placeholder?: string;
  buttonLabel?: string;
  showButton?: boolean;
  styles?: unknown;
}

interface SearchHit {
  type: "page" | "post" | "collection";
  title: string;
  url: string;
  snippet: string;
  rank: number;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; hits: SearchHit[]; query: string }
  | { kind: "error" };

/** Render a ts_headline snippet: split on <mark>…</mark>, everything else text. */
const Snippet: React.FC<{ html: string }> = ({ html }) => {
  if (!html) return null;
  const parts = html.split(/(<mark>.*?<\/mark>)/g);
  return (
    <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#475569" }}>
      {parts.map((part, i) => {
        const m = /^<mark>(.*?)<\/mark>$/s.exec(part);
        if (m) {
          return (
            <mark key={i} style={{ background: "#fef08a", color: "inherit" }}>
              {sanitizeText(m[1])}
            </mark>
          );
        }
        return <React.Fragment key={i}>{sanitizeText(part)}</React.Fragment>;
      })}
    </p>
  );
};

export const Search = React.forwardRef<HTMLDivElement, SearchBlockProps>(
  ({ placeholder, buttonLabel, showButton = true, styles }, ref) => {
    const mounted = useMounted();
    const [value, setValue] = React.useState("");
    const [status, setStatus] = React.useState<Status>({ kind: "idle" });

    const searchBtnDefaults: React.CSSProperties = {
      padding: "0.625rem 1.25rem",
      borderRadius: "0.375rem",
      border: "none",
      backgroundColor: "#147eff",
      color: "#fff",
      font: "inherit",
      fontWeight: 600,
      cursor: "pointer",
      whiteSpace: "nowrap",
    };
    const { wrapper, surface: btnSurface } = resolveSurfaceStyles(
      styles,
      styleModelHasVisualOverrides(styles) ? {} : searchBtnDefaults,
    );

    const rootStyle: React.CSSProperties = {
      display: "block",
      boxSizing: "border-box",
      ...wrapper,
    };
    const inputStyle: React.CSSProperties = {
      flex: 1,
      minWidth: 0,
      padding: "0.625rem 0.75rem",
      border: "1px solid #d1d5db",
      borderRadius: "0.375rem",
      font: "inherit",
      boxSizing: "border-box",
    };

    const runSearch = React.useCallback(async (q: string): Promise<void> => {
      const term = q.trim();
      if (!term) {
        setStatus({ kind: "idle" });
        return;
      }
      setStatus({ kind: "loading" });
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { data?: SearchHit[] };
        const hits = Array.isArray(body.data) ? body.data : [];
        setStatus({ kind: "done", hits, query: term });
      } catch {
        setStatus({ kind: "error" });
      }
    }, []);

    const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
      e.preventDefault();
      if (!mounted) return; // builder preview / SSR: never queries.
      void runSearch(value);
    };

    return (
      <div ref={ref} style={rootStyle} className="ob-search">
        <form
          role="search"
          onSubmit={onSubmit}
          style={{ display: "flex", gap: "0.5rem", alignItems: "stretch" }}
        >
          <input
            type="search"
            name="q"
            aria-label="Search this site"
            placeholder={sanitizeText(placeholder || "Search…")}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={inputStyle}
          />
          {showButton ? (
            <button
              type="submit"
              disabled={mounted ? status.kind === "loading" : true}
              className="ob-btn cms-fluid-btn"
              style={btnSurface}
            >
              {status.kind === "loading" ? "Searching…" : sanitizeText(buttonLabel || "Search")}
            </button>
          ) : null}
        </form>

        {/* Results region — nothing rendered on the server / builder (idle). */}
        {status.kind === "loading" ? (
          <p style={{ marginTop: "0.75rem", color: "#64748b" }}>Searching…</p>
        ) : null}
        {status.kind === "error" ? (
          <p style={{ marginTop: "0.75rem", color: "#dc2626" }}>
            Something went wrong. Please try again.
          </p>
        ) : null}
        {status.kind === "done" ? (
          status.hits.length === 0 ? (
            <p style={{ marginTop: "0.75rem", color: "#64748b" }}>
              No results for “{sanitizeText(status.query)}”.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: "0.75rem 0 0",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {status.hits.map((hit, i) => (
                <li key={`${hit.url}-${i}`}>
                  <a
                    href={sanitizeUrl(hit.url) || "#"}
                    style={{ color: "#147eff", fontWeight: 600, textDecoration: "none" }}
                  >
                    {sanitizeText(hit.title)}
                  </a>
                  <Snippet html={hit.snippet} />
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    );
  },
);
Search.displayName = "Search";
