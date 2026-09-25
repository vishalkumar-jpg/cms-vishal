import * as React from "react";
import { Pipette, Bookmark } from "lucide-react";
import { Input } from "@/components/ui";
import { BuilderTip } from "../components/BuilderTip";
import { useRecentColors, useSavedColors } from "./recentColors";
import { COLOR_TOKENS } from "./styleTokens";

/** Normalize pasted hex — auto-prefix `#` and expand 3-digit shorthand. */
export const normalizeColorInput = (raw: string): string => {
  const v = raw.trim();
  if (!v) return "";
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v.toLowerCase()}`;
  if (/^[0-9a-f]{3}$/i.test(v)) {
    const [r, g, b] = v.toLowerCase().split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return v;
};

const isThemeToken = (value: string): boolean =>
  COLOR_TOKENS.some((t) => t.value === value);

/**
 * Resolve any CSS color (hex, rgb, hsl, theme token) to concrete hex + rgb so
 * the picker and hash field always show a real code.
 */
export const resolveColorParts = (value: string): { hex: string; rgb: string } | null => {
  if (!value) return null;
  if (typeof document === "undefined") {
    return /^#[0-9a-f]{6}$/i.test(value) ? { hex: value.toUpperCase(), rgb: "" } : null;
  }
  try {
    const el = document.createElement("span");
    el.style.color = "";
    el.style.color = value;
    el.style.display = "none";
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color;
    document.body.removeChild(el);
    const m = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/i);
    if (!m) return null;
    const [r, g, b] = [1, 2, 3].map((i) => Number(m[i]));
    const a = m[4] != null ? Number(m[4]) : 1;
    const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    const rgb = a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`;
    return { hex, rgb };
  } catch {
    return null;
  }
};

interface EyeDropperCtor {
  new (): { open: () => Promise<{ sRGBHex: string }> };
}

export const eyeDropperSupported = (): boolean =>
  typeof window !== "undefined" && "EyeDropper" in window;

export interface ColorPickerRowProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  compact?: boolean;
  ariaLabel?: string;
  showBookmark?: boolean;
  className?: string;
}

/** Always-visible color picker + hex/hash input (+ optional eyedropper & save). */
export const ColorPickerRow: React.FC<ColorPickerRowProps> = ({
  value,
  onChange,
  placeholder = "#147eff",
  compact,
  ariaLabel = "Pick color",
  showBookmark,
  className,
}) => {
  const addRecent = useRecentColors((s) => s.add);
  const toggleSaved = useSavedColors((s) => s.toggle);
  const isSaved = useSavedColors((s) => s.isSaved);
  const [draft, setDraft] = React.useState<string | null>(null);

  const parts = React.useMemo(() => resolveColorParts(value), [value]);
  const resolvedHex = parts?.hex?.toLowerCase() ?? "";
  const pickerHex =
    /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : resolvedHex || "#147eff";

  const commit = (v: string): void => {
    const normalized = normalizeColorInput(v);
    const out = normalized || v.trim();
    if (!out) return;
    onChange(out);
    addRecent(out);
    setDraft(null);
  };

  const displayValue =
    draft ?? (isThemeToken(value) ? resolvedHex : value || resolvedHex);

  const useEyedropper = async (): Promise<void> => {
    try {
      const Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
      if (!Ctor) return;
      const res = await new Ctor().open();
      if (res?.sRGBHex) commit(res.sRGBHex);
    } catch {
      /* user cancelled */
    }
  };

  const canSave = showBookmark && value && !isThemeToken(value);

  return (
    <div
      className={
        className ?? (compact ? "flex min-w-0 items-center gap-1" : "flex items-center gap-1.5")
      }
    >
      <BuilderTip content="Pick any color">
        <input
          type="color"
          aria-label={ariaLabel}
          className="h-7 w-9 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
          value={pickerHex}
          onChange={(e) => commit(e.target.value)}
        />
      </BuilderTip>
      <Input
        className={
          compact
            ? "h-7 min-w-0 flex-1 font-mono text-[11px]"
            : "h-7 flex-1 font-mono text-[11px]"
        }
        value={displayValue}
        placeholder={placeholder}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={(e) => {
          const raw = e.target.value.trim();
          if (!raw) {
            setDraft(null);
            return;
          }
          commit(raw);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
      />
      {eyeDropperSupported() && (
        <BuilderTip content="Pick a color from anywhere on screen">
          <button
            type="button"
            aria-label="Pick a color from the screen"
            onClick={() => void useEyedropper()}
            className="flex h-7 w-8 shrink-0 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground"
          >
            <Pipette className="h-3.5 w-3.5" />
          </button>
        </BuilderTip>
      )}
      {canSave && (
        <BuilderTip content={isSaved(value) ? "Remove from saved colors" : "Save this color"}>
          <button
            type="button"
            aria-label={isSaved(value) ? "Remove from saved colors" : "Save this color"}
            onClick={() => toggleSaved(value)}
            className={`flex h-7 w-8 shrink-0 items-center justify-center rounded border border-border ${
              isSaved(value) ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${isSaved(value) ? "fill-current" : ""}`} />
          </button>
        </BuilderTip>
      )}
    </div>
  );
};
