import * as React from "react";
import { Search, ImageIcon, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui";
import { MediaGrid } from "./MediaGrid";
import type { MediaItem } from "../types";

/**
 * Unsplash stock-photo search tab for the media picker.
 *
 * Reads the access key from `import.meta.env.VITE_UNSPLASH_ACCESS_KEY`. When the
 * key is absent the tab renders a setup message and the rest of the picker
 * (Library / Upload) keeps working. Selecting a photo synthesizes a `MediaItem`
 * whose `url` is the Unsplash regular image URL; attribution (photographer +
 * link) is preserved on the item alt + shown in a credit line, satisfying
 * Unsplash's attribution guideline.
 */

const ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string | undefined;

interface UnsplashPhoto {
  id: string;
  width: number;
  height: number;
  alt_description: string | null;
  urls: { regular: string; small: string; thumb: string };
  user: { name: string; links: { html: string } };
  links: { html: string };
}

/** Map an Unsplash photo to the picker's MediaItem shape (synthetic, not persisted). */
const toMediaItem = (p: UnsplashPhoto): MediaItem => ({
  id: `unsplash:${p.id}`,
  siteId: "",
  storageKey: p.id,
  url: p.urls.regular,
  type: "image/jpeg",
  size: null,
  width: p.width,
  height: p.height,
  alt: p.alt_description ?? `Photo by ${p.user.name} on Unsplash`,
  tags: ["unsplash"],
  variants: [],
  focalPoint: null,
  cropRect: null,
  folderId: null,
  status: "ready",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const StockSearch: React.FC<{
  selectedId?: string | null;
  onItemClick: (item: MediaItem) => void;
}> = ({ selectedId, onItemClick }) => {
  const [q, setQ] = React.useState("");
  const [photos, setPhotos] = React.useState<UnsplashPhoto[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Debounced search.
  React.useEffect(() => {
    if (!ACCESS_KEY || !q.trim()) {
      setPhotos([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      fetch(
        `https://api.unsplash.com/search/photos?per_page=24&query=${encodeURIComponent(q.trim())}`,
        { headers: { Authorization: `Client-ID ${ACCESS_KEY}` } },
      )
        .then((r) => {
          if (!r.ok) throw new Error(`Unsplash error ${r.status}`);
          return r.json() as Promise<{ results: UnsplashPhoto[] }>;
        })
        .then((data) => {
          if (!cancelled) setPhotos(data.results ?? []);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Search failed");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  if (!ACCESS_KEY) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
        <ImageIcon className="h-8 w-8 opacity-40" />
        <p>Stock search is disabled.</p>
        <p className="text-xs">
          Set <code className="rounded bg-muted px-1">VITE_UNSPLASH_ACCESS_KEY</code> to enable
          Unsplash search.
        </p>
      </div>
    );
  }

  const items = React.useMemo(() => photos.map(toMediaItem), [photos]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Unsplash photos…"
          className="pl-9"
          autoFocus
        />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="max-h-[50vh] min-h-[16rem] overflow-y-auto">
        {!q.trim() ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <Search className="h-8 w-8 opacity-40" />
            Type a term to search free Unsplash stock photos.
          </div>
        ) : (
          <MediaGrid
            items={items}
            isLoading={loading}
            selectedId={selectedId}
            onItemClick={onItemClick}
            emptyText="No photos found."
          />
        )}
      </div>
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        Photos via
        <a
          href="https://unsplash.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 underline"
        >
          Unsplash <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </div>
  );
};
