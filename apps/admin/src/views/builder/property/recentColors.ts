import { create } from "zustand";

/**
 * Recently-used custom colors — a small, persisted palette so non-technical
 * users can re-apply a color they picked earlier without re-typing a hex code.
 * Only concrete colors (hex / rgb / hsl) are stored; theme tokens are already
 * one click away in the color dropdown.
 */
const STORAGE_KEY = "ob-builder-recent-colors";
const MAX = 12;

const isConcreteColor = (v: string): boolean =>
  /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.trim()) ||
  /^(rgb|hsl)a?\(/i.test(v.trim());

const load = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const persist = (colors: string[]): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
};

interface RecentColorsState {
  colors: string[];
  add: (color: string) => void;
}

export const useRecentColors = create<RecentColorsState>((set, get) => ({
  colors: load(),
  add: (color) => {
    const c = (color || "").trim();
    if (!isConcreteColor(c)) return;
    const next = [c, ...get().colors.filter((x) => x.toLowerCase() !== c.toLowerCase())].slice(0, MAX);
    persist(next);
    set({ colors: next });
  },
}));

/* ---- Saved / pinned colors (user-curated palette) ------------------ */

const SAVED_KEY = "ob-builder-saved-colors";

const loadSaved = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const persistSaved = (colors: string[]): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(colors));
  } catch {
    /* ignore */
  }
};

interface SavedColorsState {
  colors: string[];
  toggle: (color: string) => void;
  isSaved: (color: string) => boolean;
}

export const useSavedColors = create<SavedColorsState>((set, get) => ({
  colors: loadSaved(),
  toggle: (color) => {
    const c = (color || "").trim();
    if (!isConcreteColor(c)) return;
    const exists = get().colors.some((x) => x.toLowerCase() === c.toLowerCase());
    const next = exists
      ? get().colors.filter((x) => x.toLowerCase() !== c.toLowerCase())
      : [c, ...get().colors].slice(0, MAX);
    persistSaved(next);
    set({ colors: next });
  },
  isSaved: (color) =>
    get().colors.some((x) => x.toLowerCase() === (color || "").trim().toLowerCase()),
}));

/**
 * Curated preset gradients (theme-token based so they re-theme with the site).
 * `stops` match the GradientBuilder shape used in StyleControls.
 */
export interface GradientPreset {
  label: string;
  type: "linear" | "radial" | "conic";
  angle: number;
  stops: { color: string; position: number }[];
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    label: "OB Blue",
    type: "linear",
    angle: 135,
    stops: [
      { color: "#147eff", position: 0 },
      { color: "#0a5cd8", position: 100 },
    ],
  },
  {
    label: "Glass",
    type: "linear",
    angle: 180,
    stops: [
      { color: "rgba(255,255,255,0.18)", position: 0 },
      { color: "rgba(255,255,255,0.08)", position: 100 },
    ],
  },
  {
    label: "Brand",
    type: "linear",
    angle: 135,
    stops: [
      { color: "hsl(var(--primary))", position: 0 },
      { color: "hsl(var(--accent))", position: 100 },
    ],
  },
  {
    label: "Sunset",
    type: "linear",
    angle: 135,
    stops: [
      { color: "#ff8a00", position: 0 },
      { color: "#e52e71", position: 100 },
    ],
  },
  {
    label: "Ocean",
    type: "linear",
    angle: 135,
    stops: [
      { color: "#2193b0", position: 0 },
      { color: "#6dd5ed", position: 100 },
    ],
  },
  {
    label: "Sky",
    type: "linear",
    angle: 180,
    stops: [
      { color: "#e0f2ff", position: 0 },
      { color: "#ffffff", position: 100 },
    ],
  },
  {
    label: "Midnight",
    type: "linear",
    angle: 135,
    stops: [
      { color: "#0f2027", position: 0 },
      { color: "#203a43", position: 50 },
      { color: "#2c5364", position: 100 },
    ],
  },
  {
    label: "Peach",
    type: "linear",
    angle: 135,
    stops: [
      { color: "#ffecd2", position: 0 },
      { color: "#fcb69f", position: 100 },
    ],
  },
  {
    label: "Mint",
    type: "linear",
    angle: 135,
    stops: [
      { color: "#d4fc79", position: 0 },
      { color: "#96e6a1", position: 100 },
    ],
  },
  {
    label: "Grape",
    type: "linear",
    angle: 135,
    stops: [
      { color: "#8e2de2", position: 0 },
      { color: "#4a00e0", position: 100 },
    ],
  },
  {
    label: "Spotlight",
    type: "radial",
    angle: 0,
    stops: [
      { color: "hsl(var(--primary))", position: 0 },
      { color: "hsl(var(--background))", position: 100 },
    ],
  },
];

export const gradientPresetToCss = (p: GradientPreset): string => {
  const stops = p.stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(", ");
  if (p.type === "radial") return `radial-gradient(circle, ${stops})`;
  if (p.type === "conic") return `conic-gradient(from ${p.angle}deg, ${stops})`;
  return `linear-gradient(${p.angle}deg, ${stops})`;
};
