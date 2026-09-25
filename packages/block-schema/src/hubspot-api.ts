import type { HubspotPageSyncMeta, HubspotSyncMode } from "./hubspot-sync-types";

export const HUBSPOT_API_BASE = "https://api.hubapi.com";

/** HubSpot CMS content kinds we inventory and sync. */
export type HubspotContentKind = "page" | "landing_page" | "blog_post";

export const HUBSPOT_CONTENT_KIND_BLOG_POST: HubspotContentKind = "blog_post";

/** Site page kinds excluding blog posts. */
export type HubspotPageKind = Exclude<HubspotContentKind, "blog_post">;

export interface HubspotRawContent {
  id?: string | number;
  name?: string;
  slug?: string;
  htmlTitle?: string;
  metaDescription?: string;
  updatedAt?: string;
  updated?: string;
  publishDate?: string;
  state?: string;
  currentlyPublished?: boolean;
  html?: string;
  body?: string | { html?: string };
  postBody?: string;
  widgetContainers?: Record<string, unknown>;
  featuredImage?: string;
  authorName?: string;
  tagIds?: number[];
  categoryId?: number;
  url?: string;
  language?: string;
  layoutSections?: unknown;
}

export interface HubspotListResponse {
  results?: HubspotRawContent[];
  paging?: { next?: { after?: string } };
}

export interface HubspotNormalizedContent {
  name: string;
  slug?: string;
  html: string;
  metaDescription?: string;
  htmlTitle?: string;
  updatedAt?: string;
  publishState?: string;
  featuredImage?: string;
  publishDate?: string;
  authorName?: string;
  tagIds?: number[];
  url?: string;
  language?: string;
}

export interface HubspotPreviewItem {
  hsId: string;
  kind: HubspotContentKind;
  name: string;
  slug: string;
  updatedAt: string;
  publishState?: string;
}

/** Content Audit API event (subset). */
export interface HubspotAuditEvent {
  objectId?: string | number;
  objectType?: string;
  event?: string;
  timestamp?: string;
}

export interface HubspotAuditResponse {
  results?: HubspotAuditEvent[];
  paging?: { next?: { after?: string } };
}

/** Persisted on connector_connections.sync_state when connector_id is hubspot. */
export interface HubspotSyncState {
  auditCursor?: string;
  lastAuditPollAt?: string;
  lastSyncRunAt?: string;
  lastSyncError?: string;
  pollIntervalMinutes?: number;
}

/** Office Beacon HubSpot Sandbox portal — migration source of truth. */
export const HUBSPOT_OB_SANDBOX_PORTAL_ID = "50980932";

const ONE_SECOND_MS = 1000;
const DEFAULT_HUBSPOT_REQUEST_TIMEOUT_MS = 30 * ONE_SECOND_MS;
/** Default page cap for HubSpot CMS list endpoints (site pages, landing pages, blog posts). */
const DEFAULT_HUBSPOT_LIST_MAX_PAGES = 20;
/** Default page cap for HubSpot Content Audit log fetches. */
const DEFAULT_HUBSPOT_AUDIT_LOG_MAX_PAGES = 10;
/** Default page cap for optional HubSpot blog tag inventory. */
const HUBSPOT_BLOG_TAG_LIST_MAX_PAGES = 5;

const hubspotRequestTimeoutMs = (): number => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const parsed = Number(env?.HUBSPOT_REQUEST_TIMEOUT_MS ?? DEFAULT_HUBSPOT_REQUEST_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_HUBSPOT_REQUEST_TIMEOUT_MS;
};

export const hubspotPageListPath = (kind: HubspotPageKind): string =>
  kind === "landing_page" ? "/cms/v3/pages/landing-pages" : "/cms/v3/pages/site-pages";

export const hubspotPageGetPath = (kind: HubspotPageKind, id: string): string =>
  `${hubspotPageListPath(kind)}/${id}`;

export const HUBSPOT_BLOG_POST_LIST_PATH = "/cms/v3/blogs/posts";

export const hubspotBlogPostListPath = (): string => HUBSPOT_BLOG_POST_LIST_PATH;

export const hubspotBlogPostGetPath = (id: string): string =>
  `${HUBSPOT_BLOG_POST_LIST_PATH}/${id}`;

/** Recursively collect HTML fragments from HubSpot layoutSections trees. */
export const extractHtmlFromLayoutSections = (layoutSections: unknown): string => {
  if (!layoutSections || typeof layoutSections !== "object") return "";
  const parts: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    if (typeof obj.html === "string" && obj.html.trim()) parts.push(obj.html);
    if (typeof obj.richText === "string" && obj.richText.trim()) parts.push(obj.richText);
    if (typeof obj.body === "string" && obj.body.trim()) parts.push(obj.body);
    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") walk(v);
    }
  };
  walk(layoutSections);
  return parts.join("\n");
};

export class HubspotApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "HubspotApiError";
  }
}

const firstNonEmptyHtml = (...candidates: (string | undefined)[]): string => {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return "";
};

/** Read-only GET toward HubSpot (never mutates HubSpot). */
export const hubspotGet = async <T>(
  token: string,
  path: string,
  query?: Record<string, string | undefined>,
): Promise<T> => {
  const url = new URL(`${HUBSPOT_API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), hubspotRequestTimeoutMs());
  try {
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new HubspotApiError("HubSpot request timed out. Try again.");
      }
      throw new HubspotApiError("Could not reach HubSpot. Check your network and try again.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new HubspotApiError(
        "HubSpot rejected the token. Check the private-app token and scopes.",
        res.status,
      );
    }
    if (!res.ok) {
      throw new HubspotApiError(`HubSpot request failed (${res.status}).`, res.status);
    }
    try {
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new HubspotApiError("HubSpot request timed out. Try again.");
      }
      throw new HubspotApiError("HubSpot returned an unreadable response.");
    }
  } finally {
    clearTimeout(timer);
  }
};

const extractWidgetHtml = (w: object): string => {
  const obj = w as Record<string, unknown>;
  if (typeof obj.html === "string") return obj.html;
  if (obj.body && typeof obj.body === "object") {
    const body = obj.body as Record<string, unknown>;
    if (typeof body.html === "string") return body.html;
  }
  return "";
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Top-level CMS `body` as string or HubSpot `{ html: string }` object. */
export const resolveTopLevelBodyHtml = (
  raw: Pick<HubspotRawContent, "body">,
): string | undefined => {
  if (typeof raw.body === "string" && raw.body.trim()) return raw.body;
  if (isPlainObject(raw.body) && typeof raw.body.html === "string" && raw.body.html.trim()) {
    return raw.body.html;
  }
  return undefined;
};

/** Normalized token on preview items when HubSpot content is live/published. */
export const HUBSPOT_PUBLISHED_STATE = "PUBLISHED";

export const HUBSPOT_IMPORT_SCOPES = ["published", "all"] as const;

export type HubspotImportScope = (typeof HUBSPOT_IMPORT_SCOPES)[number];

export const isHubspotPreviewItemPublished = (item: HubspotPreviewItem): boolean => {
  const state = (item.publishState ?? "").trim().toUpperCase();
  if (!state) return false;
  return state === HUBSPOT_PUBLISHED_STATE || state.startsWith("PUBLISHED");
};

/** Filter HubSpot inventory by import scope (published-only vs all eligible pages/posts). */
export const filterHubspotPreviewByScope = (
  items: HubspotPreviewItem[],
  scope: HubspotImportScope,
): HubspotPreviewItem[] => {
  if (scope === "all") return items;
  return items.filter(isHubspotPreviewItemPublished);
};

export const normalizeHubspotContent = (r: HubspotRawContent): HubspotNormalizedContent => {
  const widgetHtml = r.widgetContainers
    ? Object.values(r.widgetContainers)
        .map((w) => (w && typeof w === "object" ? extractWidgetHtml(w) : ""))
        .filter(Boolean)
        .join("\n")
    : "";
  const layoutHtml = r.layoutSections ? extractHtmlFromLayoutSections(r.layoutSections) : "";
  const html = firstNonEmptyHtml(
    r.postBody,
    r.html,
    resolveTopLevelBodyHtml(r),
    layoutHtml,
    widgetHtml,
  );
  return {
    name: r.name ?? r.htmlTitle ?? "Imported",
    slug: r.slug,
    html,
    metaDescription: r.metaDescription,
    htmlTitle: r.htmlTitle,
    updatedAt: r.updatedAt ?? r.updated,
    publishState: r.state ?? (r.currentlyPublished ? HUBSPOT_PUBLISHED_STATE : undefined),
    featuredImage: r.featuredImage,
    publishDate: r.publishDate,
    authorName: r.authorName,
    tagIds: r.tagIds,
    url: r.url,
    language: r.language,
  };
};

export interface HubspotBlogTag {
  id: string;
  name: string;
  slug?: string;
}

/** Fetch HubSpot blog tags as id → name map (cached per call site). */
export const hubspotFetchBlogTagMap = async (token: string): Promise<Map<string, string>> => {
  const map = new Map<string, string>();
  try {
    const tags = await hubspotListAll<HubspotBlogTag>(
      token,
      "/cms/v3/blogs/tags",
      HUBSPOT_BLOG_TAG_LIST_MAX_PAGES,
    );
    for (const t of tags) {
      if (t.id && t.name) map.set(String(t.id), t.name);
    }
  } catch {
    /* tags optional */
  }
  return map;
};

export const toHubspotPreviewItem = (
  r: HubspotRawContent,
  kind: HubspotContentKind,
): HubspotPreviewItem => ({
  hsId: String(r.id ?? ""),
  kind,
  name: r.name ?? r.htmlTitle ?? "(untitled)",
  slug: r.slug ?? "",
  updatedAt: r.updatedAt ?? r.updated ?? "",
  publishState: r.state ?? (r.currentlyPublished ? HUBSPOT_PUBLISHED_STATE : undefined),
});

export interface HubspotListAllResult<T> {
  items: T[];
  truncated: boolean;
}

/** Paginate a HubSpot list endpoint; returns partial results when maxPages is reached. */
export const hubspotListAllPartial = async <T = HubspotRawContent>(
  token: string,
  path: string,
  maxPages = DEFAULT_HUBSPOT_LIST_MAX_PAGES,
): Promise<HubspotListAllResult<T>> => {
  const items: T[] = [];
  let after: string | undefined;
  for (let i = 0; i < maxPages; i += 1) {
    const res = await hubspotGet<HubspotListResponse & { results?: T[] }>(
      token,
      path,
      after ? { after } : undefined,
    );
    items.push(...(res.results ?? []));
    after = res.paging?.next?.after;
    if (!after) return { items, truncated: false };
  }
  return { items, truncated: true };
};

/** Paginate a HubSpot list endpoint until exhausted (cap at maxPages). */
export const hubspotListAll = async <T = HubspotRawContent>(
  token: string,
  path: string,
  maxPages = DEFAULT_HUBSPOT_LIST_MAX_PAGES,
): Promise<T[]> => {
  const { items, truncated } = await hubspotListAllPartial<T>(token, path, maxPages);
  if (truncated) {
    throw new HubspotApiError(
      `HubSpot list pagination limit reached for ${path}. More results remain.`,
    );
  }
  return items;
};

/** List website + landing pages separately (HubSpot CMS v3). */
export const hubspotFetchAllPages = async (token: string): Promise<HubspotPreviewItem[]> => {
  const [sitePages, landingPages] = await Promise.all([
    hubspotListAll(token, hubspotPageListPath("page")),
    hubspotListAll(token, hubspotPageListPath("landing_page")),
  ]);
  return [
    ...sitePages.map((r) => toHubspotPreviewItem(r, "page")),
    ...landingPages.map((r) => toHubspotPreviewItem(r, "landing_page")),
  ];
};

/** Fetch a page by kind; when kind unknown, tries site-pages then landing-pages. */
export const hubspotFetchPage = async (
  token: string,
  id: string,
  kind?: HubspotPageKind,
): Promise<{ raw: HubspotRawContent; kind: HubspotPageKind }> => {
  if (kind === "landing_page") {
    const raw = await hubspotGet<HubspotRawContent>(token, hubspotPageGetPath("landing_page", id));
    return { raw, kind: "landing_page" };
  }
  if (kind === "page") {
    const raw = await hubspotGet<HubspotRawContent>(token, hubspotPageGetPath("page", id));
    return { raw, kind: "page" };
  }
  try {
    const raw = await hubspotGet<HubspotRawContent>(token, hubspotPageGetPath("page", id));
    return { raw, kind: "page" };
  } catch (err) {
    if (err instanceof HubspotApiError && err.status === 404) {
      const raw = await hubspotGet<HubspotRawContent>(token, hubspotPageGetPath("landing_page", id));
      return { raw, kind: "landing_page" };
    }
    throw err;
  }
};

export interface HubspotAuditFetchResult {
  events: HubspotAuditEvent[];
  /** Present when pagination was capped before all audit events were fetched. */
  continuationCursor?: string;
}

/** Fetch Content Audit events since cursor (ISO timestamp). Read-only. */
export const hubspotFetchAuditEvents = async (
  token: string,
  afterIso: string,
  objectTypes: string[],
  maxPages = DEFAULT_HUBSPOT_AUDIT_LOG_MAX_PAGES,
): Promise<HubspotAuditFetchResult> => {
  const events: HubspotAuditEvent[] = [];
  let after: string | undefined;
  const objectTypeParam = objectTypes.join(",");
  for (let page = 0; page < maxPages; page += 1) {
    const res = await hubspotGet<HubspotAuditResponse>(
      token,
      "/cms/v3/audit-logs",
      {
        after: after ?? afterIso,
        objectType: objectTypeParam,
        limit: "100",
      },
    );
    events.push(...(res.results ?? []));
    after = res.paging?.next?.after;
    if (!after) {
      return { events };
    }
    if (page === maxPages - 1) {
      return { events, continuationCursor: after };
    }
  }
  return { events };
};

export const parseHubspotSyncMeta = (raw: unknown): HubspotPageSyncMeta | null => {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.contentHash !== "string" || typeof o.embedHtmlHash !== "string") return null;
  const mode = o.syncMode;
  const syncMode: HubspotSyncMode =
    mode === "FROZEN" || mode === "CONFLICT" || mode === "AUTO" ? mode : "AUTO";
  return {
    syncMode,
    contentHash: o.contentHash,
    embedHtmlHash: o.embedHtmlHash,
    lastSyncedAt: typeof o.lastSyncedAt === "string" ? o.lastSyncedAt : undefined,
    lastConflictAt: typeof o.lastConflictAt === "string" ? o.lastConflictAt : undefined,
    lastConflictMessage:
      typeof o.lastConflictMessage === "string" ? o.lastConflictMessage : undefined,
  };
};

/** OB CMS page/post slug max length (matches API `@MaxLength(200)`). */
export const HUBSPOT_SLUG_MAX_LENGTH = 200;
const HUBSPOT_SLUG_MIN_BASE_LENGTH = 1;
/** Longest `-{suffix}` segment that still leaves room for a one-character base. */
export const HUBSPOT_SLUG_MAX_SUFFIX_LENGTH =
  HUBSPOT_SLUG_MAX_LENGTH - HUBSPOT_SLUG_MIN_BASE_LENGTH - 1;

export class HubspotSlugError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HubspotSlugError";
  }
}

const normalizeHubspotSlugInput = (input: string): string =>
  (input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Max base length before appending `-{suffix}` while staying within {@link HUBSPOT_SLUG_MAX_LENGTH}. */
export const hubspotSlugMaxBaseLength = (suffix: string | number = ""): number => {
  const suffixText = suffix === "" || suffix === 0 ? "" : String(suffix);
  if (!suffixText) return HUBSPOT_SLUG_MAX_LENGTH;
  if (suffixText.length > HUBSPOT_SLUG_MAX_SUFFIX_LENGTH) {
    throw new HubspotSlugError(
      `HubSpot slug suffix exceeds maximum length (${HUBSPOT_SLUG_MAX_SUFFIX_LENGTH}).`,
    );
  }
  return HUBSPOT_SLUG_MAX_LENGTH - 1 - suffixText.length;
};

export const slugifyHubspot = (
  input: string,
  collisionSuffix: string | number = "",
): string => {
  const suffixText =
    collisionSuffix === "" || collisionSuffix === 0 ? "" : String(collisionSuffix);
  const maxBaseLen = hubspotSlugMaxBaseLength(collisionSuffix);
  const base = normalizeHubspotSlugInput(input).slice(0, maxBaseLen);
  if (!base) {
    const fallback = `imported-${Date.now()}`.slice(0, maxBaseLen);
    return suffixText ? `${fallback}-${suffixText}` : fallback;
  }
  return suffixText ? `${base}-${suffixText}` : base;
};
