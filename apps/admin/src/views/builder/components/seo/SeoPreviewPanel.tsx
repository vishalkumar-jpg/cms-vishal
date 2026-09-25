import * as React from "react";
import { CheckCircle2, AlertTriangle, XCircle, ImageOff } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { scoreSeo, type SeoScoreResult, type CheckStatus } from "./seoScore";

/**
 * Live SEO preview + scoring for the page settings/SEO panel (gap D22).
 *
 * Renders three things from the title/description/OG-image/slug the user is
 * editing, updating on every keystroke:
 *   1. A Google result snippet (title / URL / description, truncated like SERP).
 *   2. A Facebook/Twitter social card (OG image + title + description + domain).
 *   3. A 0–100 SEO score with a pass/warn/fail checklist of recommendations.
 *
 * Pure presentational + client-side scoring — no network calls.
 */
export interface SeoPreviewPanelProps {
  title?: string;
  description?: string;
  ogImage?: string;
  slug?: string;
  /** Site name shown in the social card + as a title fallback. */
  siteName?: string;
  /** Public base URL (e.g. https://acme.com) for the preview URL/domain. */
  baseUrl?: string;
  /** Optional sampled layout signals to enrich the score. */
  h1Count?: number;
  imagesMissingAlt?: number;
}

const TITLE_SERP_MAX = 60;
const DESC_SERP_MAX = 160;

export const SeoPreviewPanel: React.FC<SeoPreviewPanelProps> = ({
  title,
  description,
  ogImage,
  slug,
  siteName,
  baseUrl,
  h1Count,
  imagesMissingAlt,
}) => {
  const effectiveTitle = (title?.trim() || siteName || "Untitled page").trim();
  const effectiveDesc =
    description?.trim() || "Add a meta description to control the search snippet.";
  const origin = normalizeBase(baseUrl);
  const domain = origin ? safeHost(origin) : "example.com";
  const path = slug && slug !== "home" ? `/${slug}` : "/";
  const displayUrl = `${domain}${path}`;

  const result: SeoScoreResult = React.useMemo(
    () => scoreSeo({ title, description, ogImage, slug, h1Count, imagesMissingAlt }),
    [title, description, ogImage, slug, h1Count, imagesMissingAlt],
  );

  return (
    <div className="flex flex-col gap-3">
      <Tabs defaultValue="google">
        <TabsList className="w-full">
          <TabsTrigger value="google" className="flex-1">
            Google
          </TabsTrigger>
          <TabsTrigger value="social" className="flex-1">
            Social card
          </TabsTrigger>
          <TabsTrigger value="score" className="flex-1">
            Score ({result.score})
          </TabsTrigger>
        </TabsList>

        {/* Google SERP snippet */}
        <TabsContent value="google">
          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-950">
            <div className="text-xs text-[#202124] dark:text-zinc-400">{displayUrl}</div>
            <div className="mt-0.5 truncate text-lg leading-snug text-[#1a0dab] dark:text-blue-400">
              {truncate(effectiveTitle, TITLE_SERP_MAX)}
            </div>
            <div className="mt-1 text-sm leading-snug text-[#4d5156] dark:text-zinc-300">
              {truncate(effectiveDesc, DESC_SERP_MAX)}
            </div>
          </div>
        </TabsContent>

        {/* Facebook / Twitter style card */}
        <TabsContent value="social">
          <div className="overflow-hidden rounded-lg border">
            <div className="aspect-[1.91/1] w-full bg-muted">
              {ogImage ? (
                <img
                  src={ogImage}
                  alt="Social share preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                  <ImageOff className="h-6 w-6" />
                  <span className="text-xs">No OG image set</span>
                </div>
              )}
            </div>
            <div className="bg-muted/40 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {domain}
              </div>
              <div className="mt-0.5 truncate text-sm font-semibold">
                {truncate(effectiveTitle, 70)}
              </div>
              <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {truncate(effectiveDesc, 120)}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* SEO score + checklist */}
        <TabsContent value="score">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <ScoreRing score={result.score} />
              <div className="text-sm">
                <div className="font-semibold">
                  {scoreLabel(result.score)} · {result.score}/100
                </div>
                <div className="text-xs text-muted-foreground">
                  {result.passed} of {result.total} checks passing
                </div>
              </div>
            </div>
            <ul className="flex flex-col gap-1.5">
              {result.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-sm">
                  <StatusIcon status={c.status} />
                  <div className="flex flex-col">
                    <span className={c.status === "pass" ? "text-muted-foreground" : ""}>
                      {c.label}
                    </span>
                    {c.status !== "pass" && c.hint ? (
                      <span className="text-xs text-muted-foreground">{c.hint}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const StatusIcon: React.FC<{ status: CheckStatus }> = ({ status }) => {
  if (status === "pass")
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />;
  if (status === "warn")
    return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />;
  return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />;
};

const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const color =
    score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
      style={{
        background: `conic-gradient(${color} ${score * 3.6}deg, #e5e7eb 0deg)`,
      }}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-foreground">
        {score}
      </div>
    </div>
  );
};

function scoreLabel(score: number): string {
  if (score >= 80) return "Good";
  if (score >= 50) return "Needs work";
  return "Poor";
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

function normalizeBase(base?: string): string {
  if (!base) return "";
  return /^https?:\/\//i.test(base) ? base : `https://${base}`;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//i, "").split("/")[0] || "example.com";
  }
}
