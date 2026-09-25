import * as React from "react";
import { Link2, Globe } from "lucide-react";
import { Input, Label } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { useSitePageLinks } from "../hooks/useSitePageLinks";

/**
 * URL control with an Internal-page / External-URL toggle.
 *  - Internal: a picker listing the site's pages; selecting one stores its
 *    resolved path (e.g. `/about`, or `/` for the home page).
 *  - External: a free-text URL input.
 *
 * Used by the builder property panel for url-type props (url, href, ctaUrl, …)
 * and reusable elsewhere. The stored value is always a plain string.
 */
export const PagePickerField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => {
  const { options } = useSitePageLinks();

  // A value is "internal" if it matches a known page path (or is a root-relative
  // path). Default new/empty values to internal when the site has pages.
  const matchesInternal = React.useMemo(
    () => options.some((o) => o.path === value),
    [options, value],
  );
  const looksInternal = value === "" ? options.length > 0 : value.startsWith("/");

  const [mode, setMode] = React.useState<"internal" | "external">(
    matchesInternal || looksInternal ? "internal" : "external",
  );

  // Keep mode in sync when an external value is set programmatically.
  React.useEffect(() => {
    if (value && !value.startsWith("/") && !matchesInternal) setMode("external");
  }, [value, matchesInternal]);

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex gap-1 rounded-md bg-muted/60 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setMode("internal")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 font-medium transition-colors",
            mode === "internal" ? "bg-background shadow-sm" : "text-muted-foreground",
          )}
        >
          <Link2 className="h-3 w-3" /> Internal page
        </button>
        <button
          type="button"
          onClick={() => setMode("external")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 font-medium transition-colors",
            mode === "external" ? "bg-background shadow-sm" : "text-muted-foreground",
          )}
        >
          <Globe className="h-3 w-3" /> External URL
        </button>
      </div>

      {mode === "internal" ? (
        options.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No pages in this website yet.
          </p>
        ) : (
          <Select
            value={matchesInternal ? value : undefined}
            onValueChange={(v) => onChange(v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select a page…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.path}>
                  {o.title}{" "}
                  <span className="text-muted-foreground">({o.path})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      ) : (
        <Input
          value={value}
          placeholder="https://example.com"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
};
