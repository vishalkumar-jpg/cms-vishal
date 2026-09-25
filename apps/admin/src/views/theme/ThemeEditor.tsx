import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
} from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import { useMediaPicker } from "@/views/media/components/MediaPickerProvider";
import { useSiteStore } from "@/store/siteStore";
import { useTheme, useUpdateTheme } from "./hooks/useTheme";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const PRESETS = ["default", "minimal", "bold", "editorial", "classic"] as const;

const COLOR_KEYS = [
  "primary",
  "secondary",
  "background",
  "foreground",
  "accent",
  "muted",
] as const;
type ColorKey = (typeof COLOR_KEYS)[number];

const COLOR_LABELS: Record<ColorKey, string> = {
  primary: "Primary",
  secondary: "Secondary",
  background: "Background",
  foreground: "Foreground",
  accent: "Accent",
  muted: "Muted",
};

/** Read a string token, falling back to `fallback` when absent / non-string. */
const str = (rec: Record<string, unknown>, key: string, fallback = ""): string => {
  const v = rec[key];
  return typeof v === "string" ? v : fallback;
};

/** Read a numeric token as its string form (for number <input>s). */
const num = (rec: Record<string, unknown>, key: string): string => {
  const v = rec[key];
  if (typeof v === "number") return String(v);
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return v;
  return "";
};

/** A CSS color string usable in `type="color"` (needs a hex). */
const asHexSwatch = (value: string): string =>
  /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : "#000000";

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */

interface FieldProps {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, htmlFor, children }) => (
  <div className="space-y-1.5">
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
);

interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}

const ColorField: React.FC<ColorFieldProps> = ({ id, label, value, onChange }) => (
  <Field label={label} htmlFor={id}>
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`${label} color swatch`}
        value={asHexSwatch(value)}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
      />
      <Input
        id={id}
        value={value}
        placeholder="#000000 / rgb(...)"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  </Field>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-sm font-semibold text-foreground">{children}</h3>
);

/* ------------------------------------------------------------------ */
/* ThemeEditor                                                         */
/* ------------------------------------------------------------------ */

export const ThemeEditor: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const openMediaPicker = useMediaPicker();
  const { data: theme, isLoading } = useTheme();
  const update = useUpdateTheme();

  // Local editable copies, seeded from the fetched theme.
  const [preset, setPreset] = React.useState<string>("default");
  const [tokens, setTokens] = React.useState<Record<string, unknown>>({});
  const [brand, setBrand] = React.useState<Record<string, unknown>>({});
  const [rawTokens, setRawTokens] = React.useState<string>("{}");
  const [rawError, setRawError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!theme) return;
    setPreset(theme.preset ?? "default");
    setTokens(theme.tokens ?? {});
    setBrand(theme.brand ?? {});
    setRawTokens(JSON.stringify(theme.tokens ?? {}, null, 2));
    setRawError(null);
  }, [theme]);

  /* ---- token / brand mutators ---- */

  const setToken = React.useCallback((key: string, value: unknown) => {
    setTokens((prev) => {
      const next = { ...prev };
      if (value === "" || value === undefined) delete next[key];
      else next[key] = value;
      setRawTokens(JSON.stringify(next, null, 2));
      setRawError(null);
      return next;
    });
  }, []);

  const setBrandField = React.useCallback((key: string, value: unknown) => {
    setBrand((prev) => {
      const next = { ...prev };
      if (value === "" || value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  }, []);

  const onRawChange = React.useCallback((value: string) => {
    setRawTokens(value);
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        setTokens(parsed as Record<string, unknown>);
        setRawError(null);
      } else {
        setRawError("Tokens must be a JSON object.");
      }
    } catch {
      // Swallow parse errors until the JSON is valid again.
      setRawError("Invalid JSON — changes paused until valid.");
    }
  }, []);

  const onPickLogo = React.useCallback(async () => {
    const item = await openMediaPicker();
    if (item?.url) setBrandField("logoUrl", item.url);
  }, [openMediaPicker, setBrandField]);

  const onSave = React.useCallback(() => {
    update.mutate(
      { preset, tokens, brand },
      {
        onSuccess: () => toast.success("Theme saved"),
        onError: () => toast.error("Failed to save theme"),
      },
    );
  }, [update, preset, tokens, brand]);

  /* ---- empty / loading states ---- */

  if (!siteId) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Theme</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize colors, typography, and branding for your site.
        </p>
        <Card className="mt-8">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Select a site to edit its theme.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !theme) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Theme</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize colors, typography, and branding for your site.
        </p>
        <Card className="mt-8">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Loading theme…
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---- preview derived values ---- */

  const previewBg = str(tokens, "background", "#ffffff");
  const previewFg = str(tokens, "foreground", "#111111");
  const previewPrimary = str(tokens, "primary", "#2563eb");
  const previewFont = str(tokens, "fontFamily", "ui-sans-serif, system-ui, sans-serif");
  const previewHeadingFont = str(tokens, "headingFontFamily", previewFont);
  const previewLogo = str(brand, "logoUrl");
  const previewName = str(brand, "name", "Your brand");
  const previewTagline = str(brand, "tagline");

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Theme</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Customize colors, typography, and branding for your site.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(280px,360px)]">
        {/* -------------------------------------------------------- */}
        {/* Editor controls                                          */}
        {/* -------------------------------------------------------- */}
        <div className="space-y-6">
          {/* Preset */}
          <Card>
            <CardHeader>
              <CardTitle>Preset</CardTitle>
            </CardHeader>
            <CardContent>
              <Field label="Base preset" htmlFor="theme-preset">
                <Select value={preset} onValueChange={setPreset}>
                  <SelectTrigger id="theme-preset">
                    <SelectValue placeholder="Select a preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>

          {/* Tokens */}
          <Card>
            <CardHeader>
              <CardTitle>Tokens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Colors */}
              <div className="space-y-3">
                <SectionTitle>Colors</SectionTitle>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {COLOR_KEYS.map((key) => (
                    <ColorField
                      key={key}
                      id={`token-${key}`}
                      label={COLOR_LABELS[key]}
                      value={str(tokens, key)}
                      onChange={(v) => setToken(key, v)}
                    />
                  ))}
                </div>
              </div>

              {/* Typography */}
              <div className="space-y-3">
                <SectionTitle>Typography</SectionTitle>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Font family" htmlFor="token-fontFamily">
                    <Input
                      id="token-fontFamily"
                      value={str(tokens, "fontFamily")}
                      placeholder="ui-sans-serif, system-ui"
                      onChange={(e) => setToken("fontFamily", e.target.value)}
                    />
                  </Field>
                  <Field label="Heading font family" htmlFor="token-headingFontFamily">
                    <Input
                      id="token-headingFontFamily"
                      value={str(tokens, "headingFontFamily")}
                      placeholder="ui-serif, Georgia"
                      onChange={(e) => setToken("headingFontFamily", e.target.value)}
                    />
                  </Field>
                  <Field label="Base font size (px)" htmlFor="token-baseFontSize">
                    <Input
                      id="token-baseFontSize"
                      type="number"
                      value={num(tokens, "baseFontSize")}
                      placeholder="16"
                      onChange={(e) =>
                        setToken(
                          "baseFontSize",
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                    />
                  </Field>
                </div>
              </div>

              {/* Spacing */}
              <div className="space-y-3">
                <SectionTitle>Spacing</SectionTitle>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Base spacing (px)" htmlFor="token-baseSpacing">
                    <Input
                      id="token-baseSpacing"
                      type="number"
                      value={num(tokens, "baseSpacing")}
                      placeholder="8"
                      onChange={(e) =>
                        setToken(
                          "baseSpacing",
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                    />
                  </Field>
                  <Field label="Radius" htmlFor="token-radius">
                    <Input
                      id="token-radius"
                      value={str(tokens, "radius")}
                      placeholder="0.5rem"
                      onChange={(e) => setToken("radius", e.target.value)}
                    />
                  </Field>
                </div>
              </div>

              {/* Advanced raw JSON */}
              <details className="rounded-lg border border-border bg-card p-3">
                <summary className="cursor-pointer text-sm font-medium text-foreground">
                  Advanced (raw JSON)
                </summary>
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={rawTokens}
                    spellCheck={false}
                    rows={10}
                    onChange={(e) => onRawChange(e.target.value)}
                    className={cn(
                      "font-mono text-xs",
                      rawError && "border-destructive focus-visible:ring-destructive",
                    )}
                  />
                  {rawError ? (
                    <p className="text-xs text-destructive">{rawError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Edit any token directly — extra keys are preserved.
                    </p>
                  )}
                </div>
              </details>
            </CardContent>
          </Card>

          {/* Brand */}
          <Card>
            <CardHeader>
              <CardTitle>Brand</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="brand-name">
                  <Input
                    id="brand-name"
                    value={str(brand, "name")}
                    placeholder="Acme Inc."
                    onChange={(e) => setBrandField("name", e.target.value)}
                  />
                </Field>
                <Field label="Tagline" htmlFor="brand-tagline">
                  <Input
                    id="brand-tagline"
                    value={str(brand, "tagline")}
                    placeholder="Build better, faster."
                    onChange={(e) => setBrandField("tagline", e.target.value)}
                  />
                </Field>
              </div>

              <div className="space-y-1.5">
                <Label>Logo</Label>
                {previewLogo ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={previewLogo}
                      alt="Brand logo"
                      className="h-16 w-16 rounded-lg border border-border object-contain bg-card"
                    />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={onPickLogo}>
                        Replace
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setBrandField("logoUrl", "")}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button type="button" variant="outline" onClick={onPickLogo}>
                    Choose logo…
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* -------------------------------------------------------- */}
        {/* Live preview                                             */}
        {/* -------------------------------------------------------- */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="space-y-4 rounded-lg border border-border p-6"
                style={{
                  background: previewBg,
                  color: previewFg,
                  fontFamily: previewFont,
                }}
              >
                {previewLogo ? (
                  <img
                    src={previewLogo}
                    alt={previewName}
                    className="h-10 w-auto object-contain"
                  />
                ) : null}
                <div>
                  <h2
                    className="text-xl font-semibold"
                    style={{ fontFamily: previewHeadingFont, color: previewFg }}
                  >
                    {previewName}
                  </h2>
                  {previewTagline ? (
                    <p className="text-sm opacity-80">{previewTagline}</p>
                  ) : null}
                </div>
                <p className="text-sm leading-relaxed opacity-90">
                  The quick brown fox jumps over the lazy dog. This sample paragraph
                  shows how body copy looks with your selected colors and typography.
                </p>
                <button
                  type="button"
                  className="rounded-md px-4 py-2 text-sm font-medium"
                  style={{
                    background: previewPrimary,
                    color: previewBg,
                    borderRadius: str(tokens, "radius", "0.375rem"),
                  }}
                >
                  Primary button
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 z-10 mt-8 flex justify-end border-t border-border bg-background/80 py-4 backdrop-blur">
        <Button type="button" onClick={onSave} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
};
