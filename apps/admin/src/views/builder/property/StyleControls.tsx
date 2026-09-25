import * as React from "react";
import { useEditor } from "@craftjs/core";
import {
  Monitor,
  Tablet,
  Smartphone,
  Laptop,
  Maximize2,
  RotateCcw,
  MousePointerClick,
  Plus,
  Trash2,
  AlignStartVertical,
  HelpCircle,
  Link2,
  Unlink,
} from "lucide-react";
import { BackgroundImageField } from "./BackgroundImageField";
import { ColorPickerRow, resolveColorParts } from "./colorPickerRow";
import { Label } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui";
import { Switch } from "@/components/ui/switch";
import { useEditorUiStore } from "../store/editorUiStore";
import { styleBreakpointKey } from "../store/editorUiStore";
import { useUpdateProp } from "./useUpdateProp";
import { BulkStyleBar } from "./BulkStyleBar";
import { BuilderTip } from "../components/BuilderTip";
import { useEnforcedGuardrails } from "../guardrails/useGuardrails";
import {
  useRecentColors,
  useSavedColors,
  GRADIENT_PRESETS,
  gradientPresetToCss,
} from "./recentColors";
import { buildGradientCss, mergeStyleModelAtBreakpoint, styleBreakpointParent } from "@ob-cms/block-schema";
import type { StyleModel } from "@ob-cms/block-schema";

/**
 * GUARDRAILS: when a node has `colorsTokenOnly` enforced, every ColorField in
 * this panel must drop its "Custom…" raw-value escape hatch. Threaded via
 * context so the existing color callsites stay untouched.
 */
const TokenOnlyColorContext = React.createContext(false);

/** Small preset scale for border thickness (ScaleField also allows Custom…). */
const BORDER_WIDTH_SCALE: { label: string; value: number }[] = [
  { label: "0", value: 0 },
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "6", value: 6 },
  { label: "8", value: 8 },
];
import {
  BORDER_STYLES,
  COLOR_TOKENS,
  DISPLAY_OPTIONS,
  FLEX_DIRECTION,
  FLEX_WRAP,
  FONT_FAMILIES,
  FONT_SIZE_SCALE,
  FONT_STYLE,
  FONT_WEIGHTS,
  GRADIENT_TYPES,
  GRID_AUTO_FLOW,
  GRID_TRACK_PRESETS,
  LETTER_SPACING_SCALE,
  LINE_HEIGHT_SCALE,
  MATRIX_ALIGN,
  MATRIX_JUSTIFY,
  SHADOW_LAYER_PRESETS,
  SPACING_SCALE,
  TEXT_ALIGN,
  TEXT_DECORATION,
  TEXT_STYLE_PRESETS,
  TEXT_TRANSFORM,
  TRANSITION_PROPERTIES,
  TRANSITION_TIMINGS,
  parseShadowLayers,
  shadowsToCss,
  type Breakpoint,
  type ShadowLayer,
} from "./styleTokens";

/**
 * StyleModel-driven controls. Writes into the node's `styles` prop — desktop
 * edits go to `styles.<section>.<key>`, tablet/mobile edits to
 * `styles.responsive.<bp>.<section>.<key>` (per-breakpoint overrides), and
 * element-state edits (hover/focus/active) to `styles.states.<state>.<section>`.
 *
 * EVERY control in this panel — including the new flex/grid editor, gradient,
 * multi-shadow, filter, transform, deep typography, and transitions builders —
 * routes through the SAME `set`/`reset`/`source` helpers, so a gradient set on
 * "Hover / Mobile" lands in the correct breakpoint+state layer and stays in sync
 * with the device + state switchers. `cssFromStyles()` consumes this exact shape.
 */
/** Which control groups to render — split across Layout vs Style tabs. */
export type StyleControlSections = "all" | "visual" | "layout";

interface StyleControlsProps {
  nodeId: string;
  styles: Record<string, unknown>;
  breakpoint: Breakpoint;
  /**
   * Prop root the StyleModel lives at. Defaults to `"styles"` (the block's own
   * styles). Sub-part editing passes a scoped path like
   * `"partStyles.title"` so the exact same controls edit a part's StyleModel.
   */
  rootPath?: string;
  /** `visual` = colors/typography/borders only; `layout` = spacing/arrangement/position. */
  sections?: StyleControlSections;
}

type Dict = Record<string, unknown>;

const asDict = (v: unknown): Dict => (v && typeof v === "object" ? (v as Dict) : {});
const numOr = (v: unknown, d: number): number =>
  v == null || v === "" || Number.isNaN(Number(v)) ? d : Number(v);

// The alignment matrix speaks flex keywords; grid's justify-items/align-items use
// start/center/end. Map both ways so the matrix drives valid grid CSS.
const FLEX_TO_GRID: Record<string, string> = {
  "flex-start": "start",
  "flex-end": "end",
  center: "center",
  stretch: "stretch",
};
const GRID_TO_FLEX: Record<string, string> = {
  start: "flex-start",
  end: "flex-end",
  center: "center",
  stretch: "stretch",
};

// Sizing / position / media option lists (resolved by `resolveStyles` already).
const POSITION_OPTIONS = ["static", "relative", "absolute", "fixed", "sticky"];
const OVERFLOW_OPTIONS = ["visible", "hidden", "auto", "scroll", "clip"];
const CURSOR_OPTIONS = [
  "auto",
  "default",
  "pointer",
  "text",
  "move",
  "grab",
  "not-allowed",
  "zoom-in",
  "zoom-out",
];
const CURSOR_LABELS = [
  "Auto",
  "Default",
  "Pointer (clickable)",
  "Text",
  "Move",
  "Grab",
  "Not allowed",
  "Zoom in",
  "Zoom out",
];
const OBJECT_FIT_OPTIONS = ["fill", "contain", "cover", "none", "scale-down"];
const OBJECT_FIT_LABELS = ["Fill", "Contain", "Cover", "None", "Scale down"];
const OBJECT_POSITION_OPTIONS = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "top left",
  "top right",
  "bottom left",
  "bottom right",
];

/**
 * Live-measure an element's rendered box so the Sizing panel can show the current
 * W×H (and let the user snap the width/height fields to it). Re-measures on
 * element resize + window resize. Works for a whole block root or a sub-part
 * element, whichever is passed in.
 */
const useElementSize = (el: HTMLElement | null): { w: number; h: number } | null => {
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null);
  React.useEffect(() => {
    if (!el) {
      setSize(null);
      return;
    }
    let raf = 0;
    const measure = (): void => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect();
        setSize({ w: Math.round(r.width), h: Math.round(r.height) });
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [el]);
  return size;
};

const DEVICES: { key: Breakpoint; icon: React.ReactNode; label: string }[] = [
  { key: "largeDesktop", icon: <Maximize2 className="h-3.5 w-3.5" />, label: "Large" },
  { key: "desktop", icon: <Monitor className="h-3.5 w-3.5" />, label: "Desktop" },
  { key: "laptop", icon: <Laptop className="h-3.5 w-3.5" />, label: "Laptop" },
  { key: "tablet", icon: <Tablet className="h-3.5 w-3.5" />, label: "Tablet" },
  { key: "mobile", icon: <Smartphone className="h-3.5 w-3.5" />, label: "Mobile" },
];

type StateKey = "default" | "hover" | "focus" | "active" | "visited" | "disabled";
const STATES: { key: StateKey; label: string }[] = [
  { key: "default", label: "Default" },
  { key: "hover", label: "Hover" },
  { key: "focus", label: "Focus" },
  { key: "active", label: "Active" },
  { key: "visited", label: "Visited" },
  { key: "disabled", label: "Disabled" },
];
const STATE_PSEUDO: Record<StateKey, string> = {
  default: "",
  hover: ":hover",
  focus: ":focus",
  active: ":active",
  visited: ":visited",
  disabled: ":disabled",
};

export const StyleControls: React.FC<StyleControlsProps> = React.memo(({
  nodeId,
  styles,
  breakpoint,
  rootPath = "styles",
  sections = "all",
}) => {
  const showLayout = sections === "all" || sections === "layout";
  const showVisual = sections === "all" || sections === "visual";
  const update = useUpdateProp(nodeId);
  const setBreakpoint = useEditorUiStore((s) => s.setBreakpoint);
  const showAdvanced = useEditorUiStore((s) => s.uiLevel !== "simple");
  const enforced = useEnforcedGuardrails(nodeId);
  const tokenOnly = enforced.colorsTokenOnly === true;
  const setStylePreviewState = useEditorUiStore((s) => s.setStylePreviewState);

  const styleBp = styleBreakpointKey(breakpoint);

  const [stateKey, setStateKey] = React.useState<StateKey>("default");
  const isState = stateKey !== "default";

  React.useEffect(() => {
    setStylePreviewState(stateKey === "default" ? null : stateKey);
    return () => setStylePreviewState(null);
  }, [stateKey, setStylePreviewState]);

  const isBreakpointOverride = styleBp !== "desktop";
  const isOverride = isBreakpointOverride && !isState;

  const responsiveLayer = asDict(asDict(styles["responsive"])[styleBp]);
  const stateLayer = asDict(asDict(styles["states"])[stateKey]);
  const effectiveModel = React.useMemo(
    () => (isOverride ? mergeStyleModelAtBreakpoint(styles as StyleModel, styleBp) : styles),
    [isOverride, styles, styleBp],
  );
  const source: Dict = isState ? stateLayer : effectiveModel;
  const pathPrefix = isState
    ? `${rootPath}.states.${stateKey}`
    : isOverride
      ? `${rootPath}.responsive.${styleBp}`
      : rootPath;

  const section = (name: string): Dict => asDict(source[name]);

  const set = (sectionName: string, key: string, value: unknown): void => {
    update(`${pathPrefix}.${sectionName}.${key}`, value === "" ? undefined : value);
  };
  // Write a whole sub-object (used by gradient/transform/shadow builders).
  const setObject = (sectionName: string, key: string, value: unknown): void => {
    update(`${pathPrefix}.${sectionName}.${key}`, value);
  };

  const overridden = (sectionName: string, key: string): boolean => {
    if (isState) return asDict(stateLayer[sectionName])[key] !== undefined;
    if (isOverride) return asDict(responsiveLayer[sectionName])[key] !== undefined;
    return false;
  };

  const reset = (sectionName: string, key: string): void => {
    update(`${pathPrefix}.${sectionName}.${key}`, undefined);
  };

  const desktopResponsiveLayer = asDict(asDict(styles["responsive"]).desktop);
  const hidden =
    styleBp === "desktop" && !isOverride
      ? desktopResponsiveLayer["hidden"] === true
      : responsiveLayer["hidden"] === true;
  const setHidden = (v: boolean): void => {
    if (styleBp === "desktop" && !isOverride) {
      update(`${rootPath}.responsive.desktop.hidden`, v ? true : undefined);
      return;
    }
    update(`${rootPath}.responsive.${styleBp}.hidden`, v ? true : undefined);
  };

  const colors = section("colors");
  const spacing = section("spacing");
  const typography = section("typography");
  const textEffects = section("textEffects");
  const layout = section("layout");
  const borders = section("borders");
  const shadows = section("shadows");
  const effects = section("effects");
  const interaction = section("interaction");
  const sizing = section("sizing");
  const position = section("position");
  const advanced = section("advanced");
  const mediaEffects = section("mediaEffects");

  // Live rendered size of what we're editing. For a sub-part (rootPath like
  // "partStyles.title") we measure that tagged element inside the block; for the
  // whole block we measure its Craft root DOM. Uses Craft's authoritative node
  // DOM (reliable across selection changes) rather than a document query.
  const subPartKey = rootPath.startsWith("partStyles.")
    ? rootPath.slice("partStyles.".length)
    : null;
  const { nodeDom } = useEditor((_state, query) => {
    let dom: HTMLElement | null = null;
    try {
      dom = (query.node(nodeId).get().dom as HTMLElement | null) ?? null;
    } catch {
      dom = null;
    }
    return { nodeDom: dom };
  });
  const targetEl =
    subPartKey && nodeDom
      ? (nodeDom.querySelector(`[data-subpart="${CSS.escape(subPartKey)}"]`) as HTMLElement | null)
      : nodeDom;
  const measured = useElementSize(targetEl);
  const positionValue = String(position["position"] ?? "");
  const positioned = positionValue !== "" && positionValue !== "static";

  const ov = (sectionName: string, key: string) => ({
    overridden: overridden(sectionName, key),
    onReset: () => reset(sectionName, key),
  });

  const display = String(layout["display"] ?? "");
  const isFlex = display === "flex";
  const isGrid = display === "grid";

  // Background mode: gradient when a backgroundGradient sub-object is present.
  const gradient = asDict(colors["backgroundGradient"]);
  const isGradient = Array.isArray(gradient["stops"]) && (gradient["stops"] as unknown[]).length > 0;
  const textGradient = asDict(colors["textGradient"]);
  const isTextGradient =
    Array.isArray(textGradient["stops"]) && (textGradient["stops"] as unknown[]).length > 0;
  const borderGradient = asDict(borders["gradient"]);
  const isBorderGradient =
    Array.isArray(borderGradient["stops"]) && (borderGradient["stops"] as unknown[]).length > 0;

  const transform = asDict(effects["transform"]);

  return (
    <TokenOnlyColorContext.Provider value={tokenOnly}>
    <div className="flex flex-col gap-5 text-xs">
      {showVisual && tokenOnly && (
        <p className="rounded-md border border-amber-300/60 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Brand guardrails: colors are limited to theme tokens.
        </p>
      )}
      <DeviceSwitcher value={breakpoint} onChange={setBreakpoint} />
      <StateSwitcher value={stateKey} onChange={setStateKey} />

      {isState ? (
        <p className="-mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <MousePointerClick className="h-3 w-3" />
          Applies on <code className="rounded bg-muted px-1">{STATE_PSEUDO[stateKey]}</code>. Unset
          fields use the base style; changes animate via the transition.
        </p>
      ) : (
        <p className="-mt-2 text-[11px] text-muted-foreground">
          {isOverride
            ? `Editing ${breakpoint} overrides. Unset fields inherit ${styleBreakpointParent(styleBp)}.`
            : "Editing the base (desktop) appearance — applies to all devices unless overridden."}
        </p>
      )}

      {!isState && (isOverride || styleBp === "desktop") && (
        <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <span className="font-medium">
            Hide on {styleBp === "desktop" && !isOverride ? "desktop (wide screens)" : breakpoint}
          </span>
          <Switch checked={hidden} onCheckedChange={setHidden} />
        </label>
      )}

      <BulkStyleBar nodeId={nodeId} rootPath={rootPath} />

      {showVisual && (
      <>
      {/* ---------------------------------------------------------- Colors */}
      <Group
        title="Background & Colors"
        help="Background fill (solid or gradient), text fill (solid or gradient), and optional background image."
      >
        <GradientOrSolidField
          toggleLabel="Type"
          isGradient={isGradient}
          onSelectMode={(mode) => {
            if (mode === "gradient") {
              setObject("colors", "backgroundGradient", DEFAULT_STYLE_GRADIENT);
            } else {
              setObject("colors", "backgroundGradient", undefined);
            }
          }}
          gradientControl={
            <GradientBuilder
              gradient={gradient}
              onChange={(g) => setObject("colors", "backgroundGradient", g)}
            />
          }
          solidControl={
            <ColorField
              label="Background color"
              help="The fill color behind this block's content. Pick a theme color or your own."
              value={String(colors["backgroundColor"] ?? "")}
              onChange={(v) => set("colors", "backgroundColor", v)}
              {...ov("colors", "backgroundColor")}
            />
          }
        />
        <GradientOrSolidField
          toggleLabel="Text fill"
          isGradient={isTextGradient}
          onSelectMode={(mode) => {
            if (mode === "gradient") {
              setObject("colors", "textGradient", DEFAULT_STYLE_GRADIENT);
              set("colors", "gradientText", true);
            } else {
              setObject("colors", "textGradient", undefined);
              set("colors", "gradientText", undefined);
            }
          }}
          gradientControl={
            <GradientBuilder
              gradient={textGradient}
              onChange={(g) => {
                setObject("colors", "textGradient", g);
                set("colors", "gradientText", true);
              }}
            />
          }
          solidControl={
            <ColorField
              label="Text color"
              help="The color of the words inside this block."
              value={String(colors["textColor"] ?? colors["color"] ?? "")}
              onChange={(v) => set("colors", "textColor", v)}
              {...ov("colors", "textColor")}
            />
          }
        />
        <BackgroundImageField colors={colors} set={set} reset={reset} overridden={overridden} />
      </Group>
      </>
      )}

      {showLayout && (
      <>
      {/* ---------------------------------------------------------- Spacing */}
      <Group
        title="Spacing"
        help="Inner spacing (padding) is the room inside the block. Outer spacing (margin) is the gap around it."
      >
        <SidesField
          label="Inner space (padding)"
          help="Room inside the block. Link keeps sides together; unlink to pad only one side."
          group="spacing"
          scale={SPACING_SCALE}
          values={spacing}
          set={set}
          reset={reset}
          overridden={overridden}
          linked={[
            { label: "↕ Top / Bottom", keys: ["paddingTop", "paddingBottom"] },
            { label: "↔ Left / Right", keys: ["paddingLeft", "paddingRight"] },
          ]}
          sides={[
            { label: "Top", key: "paddingTop" },
            { label: "Right", key: "paddingRight" },
            { label: "Bottom", key: "paddingBottom" },
            { label: "Left", key: "paddingLeft" },
          ]}
        />
        <SidesField
          label="Outer space (margin)"
          help="Gap around the block. Link keeps sides together; unlink to space only one side."
          group="spacing"
          scale={SPACING_SCALE}
          values={spacing}
          set={set}
          reset={reset}
          overridden={overridden}
          linked={[
            { label: "Space above", keys: ["marginTop"] },
            { label: "Space below", keys: ["marginBottom"] },
          ]}
          sides={[
            { label: "Top", key: "marginTop" },
            { label: "Right", key: "marginRight" },
            { label: "Bottom", key: "marginBottom" },
            { label: "Left", key: "marginLeft" },
          ]}
        />
      </Group>
      </>
      )}

      {showVisual && (
      <>
      {/* ------------------------------------------------------- Typography */}
      <Group title="Text" help="Control how the words look — font, size, weight, spacing and alignment.">
        <div className="col-span-2 flex flex-col gap-1">
          <Label className="text-[10px] text-muted-foreground">Quick text styles</Label>
          <div className="flex flex-wrap gap-1">
            {TEXT_STYLE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                title={`Apply ${p.label} style`}
                onClick={() => {
                  Object.entries(p.typography).forEach(([k, v]) => set("typography", k, v));
                }}
                className="rounded border border-border px-2 py-1 text-[11px] hover:bg-muted"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <FontFamilyField
          value={String(typography["fontFamily"] ?? "")}
          onChange={(v) => set("typography", "fontFamily", v)}
          {...ov("typography", "fontFamily")}
        />
        <ScaleField
          label="Text size"
          value={typography["fontSize"]}
          scale={FONT_SIZE_SCALE}
          onChange={(v) => set("typography", "fontSize", v)}
          {...ov("typography", "fontSize")}
        />
        <OptionField
          label="Font weight"
          value={String(typography["fontWeight"] ?? "")}
          options={FONT_WEIGHTS}
          onChange={(v) => set("typography", "fontWeight", v)}
          {...ov("typography", "fontWeight")}
        />
        <ScaleField
          label="Line spacing"
          value={typography["lineHeight"]}
          scale={LINE_HEIGHT_SCALE}
          onChange={(v) => set("typography", "lineHeight", v)}
          {...ov("typography", "lineHeight")}
        />
        <ScaleField
          label="Letter spacing"
          value={typography["letterSpacing"]}
          scale={LETTER_SPACING_SCALE}
          onChange={(v) => set("typography", "letterSpacing", v)}
          {...ov("typography", "letterSpacing")}
        />
        <OptionField
          label="Text alignment"
          help="Line up the text to the left, center or right."
          value={String(typography["textAlign"] ?? "")}
          options={TEXT_ALIGN}
          onChange={(v) => set("typography", "textAlign", v)}
          {...ov("typography", "textAlign")}
        />
        <OptionField
          label="Letter case"
          help="Force UPPERCASE, lowercase or Capitalize."
          value={String(typography["textTransform"] ?? "")}
          options={TEXT_TRANSFORM}
          onChange={(v) => set("typography", "textTransform", v)}
          {...ov("typography", "textTransform")}
        />
        <OptionField
          label="Underline / strike"
          help="Add an underline or line-through to the text."
          value={String(typography["textDecoration"] ?? "")}
          options={TEXT_DECORATION}
          onChange={(v) => set("typography", "textDecoration", v)}
          {...ov("typography", "textDecoration")}
        />
        <OptionField
          label="Italic style"
          help="Make the text italic (slanted)."
          value={String(typography["fontStyle"] ?? "")}
          options={FONT_STYLE}
          onChange={(v) => set("typography", "fontStyle", v)}
          {...ov("typography", "fontStyle")}
        />
        <NumberField
          label="Text outline width"
          help="Outline around letters — great for text on photos."
          value={textEffects["strokeWidth"]}
          onChange={(v) => set("textEffects", "strokeWidth", v)}
          {...ov("textEffects", "strokeWidth")}
        />
        <ColorField
          label="Outline color"
          value={String(textEffects["strokeColor"] ?? "#000000")}
          onChange={(v) => set("textEffects", "strokeColor", v)}
          {...ov("textEffects", "strokeColor")}
        />
        <OptionField
          label="Text overflow"
          help="Ellipsis adds “…” when text is too long for the box."
          value={String(typography["textOverflow"] ?? "")}
          options={["", "clip", "ellipsis"]}
          labels={["Default", "Clip", "Ellipsis (…)"]}
          onChange={(v) => set("typography", "textOverflow", v)}
          {...ov("typography", "textOverflow")}
        />
        <OptionField
          label="White space"
          help="Whether text wraps to new lines or stays on one line."
          value={String(typography["whiteSpace"] ?? "")}
          options={["", "normal", "nowrap", "pre-wrap"]}
          labels={["Default", "Wrap", "No wrap", "Keep line breaks"]}
          onChange={(v) => set("typography", "whiteSpace", v)}
          {...ov("typography", "whiteSpace")}
        />
      </Group>
      </>
      )}

      {showLayout && (
      <>
      {/* ----------------------------------------------------------- Layout */}
      <FullGroup
        title="Arrangement"
        help="Decide how the items inside this block line up — stacked, in a row, or in a grid."
      >
        <OptionField
          label="Layout type"
          help="Block = normal stacking. Flex = a flexible row/column. Grid = an even grid."
          value={display}
          options={DISPLAY_OPTIONS}
          onChange={(v) => set("layout", "display", v)}
          {...ov("layout", "display")}
        />

        {isFlex && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <OptionField
                label="Layout direction"
                help="Lay items out top-to-bottom (column) or left-to-right (row)."
                value={String(layout["flexDirection"] ?? "")}
                options={FLEX_DIRECTION}
                onChange={(v) => set("layout", "flexDirection", v)}
                {...ov("layout", "flexDirection")}
              />
              <OptionField
                label="Wrap to new line"
                help="Let items flow onto the next line when they run out of room."
                value={String(layout["flexWrap"] ?? "")}
                options={FLEX_WRAP}
                onChange={(v) => set("layout", "flexWrap", v)}
                {...ov("layout", "flexWrap")}
              />
            </div>
            <AlignmentMatrix
              justify={String(layout["justifyContent"] ?? "flex-start")}
              align={String(layout["alignItems"] ?? "stretch")}
              onChange={(j, a) => {
                set("layout", "justifyContent", j);
                set("layout", "alignItems", a);
              }}
            />
              <ScaleField
                label="Space between"
                help="The gap between each item inside this block."
                value={spacing["gap"] ?? layout["gap"]}
                scale={SPACING_SCALE}
                onChange={(v) => set("spacing", "gap", v)}
                {...ov("spacing", "gap")}
              />
            <div className="grid grid-cols-2 gap-2">
              <ScaleField
                label="Column gap"
                help="Space between columns in a grid or flex row."
                value={layout["columnGap"] ?? spacing["columnGap"]}
                scale={SPACING_SCALE}
                onChange={(v) => set("layout", "columnGap", v)}
                {...ov("layout", "columnGap")}
              />
              <ScaleField
                label="Row gap"
                help="Space between rows in a grid or flex column."
                value={layout["rowGap"] ?? spacing["rowGap"]}
                scale={SPACING_SCALE}
                onChange={(v) => set("layout", "rowGap", v)}
                {...ov("layout", "rowGap")}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <NumberField
                label="Grow"
                help="How much this item expands to fill extra space (0 = don't grow)."
                value={layout["flexGrow"]}
                onChange={(v) => set("layout", "flexGrow", v)}
                {...ov("layout", "flexGrow")}
              />
              <NumberField
                label="Shrink"
                help="How much this item can shrink when space is tight (0 = don't shrink)."
                value={layout["flexShrink"]}
                onChange={(v) => set("layout", "flexShrink", v)}
                {...ov("layout", "flexShrink")}
              />
              <NumberField
                label="Order"
                help="Change the visual order of flex items (lower numbers come first)."
                value={layout["order"]}
                onChange={(v) => set("layout", "order", v)}
                {...ov("layout", "order")}
              />
            </div>
          </>
        )}

        {isGrid && (
          <>
            <GridTrackEditor
              label="Columns"
              value={String(layout["gridTemplateColumns"] ?? "")}
              onChange={(v) => set("layout", "gridTemplateColumns", v)}
            />
            <GridTrackEditor
              label="Rows"
              value={String(layout["gridTemplateRows"] ?? "")}
              onChange={(v) => set("layout", "gridTemplateRows", v)}
            />
            <div className="grid grid-cols-2 gap-2">
              <ScaleField
                label="Space between"
                value={spacing["gap"] ?? layout["gap"]}
                scale={SPACING_SCALE}
                onChange={(v) => set("spacing", "gap", v)}
                {...ov("spacing", "gap")}
              />
              <ScaleField
                label="Column gap"
                value={layout["columnGap"] ?? spacing["columnGap"]}
                scale={SPACING_SCALE}
                onChange={(v) => set("layout", "columnGap", v)}
                {...ov("layout", "columnGap")}
              />
              <ScaleField
                label="Row gap"
                value={layout["rowGap"] ?? spacing["rowGap"]}
                scale={SPACING_SCALE}
                onChange={(v) => set("layout", "rowGap", v)}
                {...ov("layout", "rowGap")}
              />
              <OptionField
                label="Auto flow"
                value={String(layout["gridAutoFlow"] ?? "")}
                options={GRID_AUTO_FLOW}
                onChange={(v) => set("layout", "gridAutoFlow", v)}
                {...ov("layout", "gridAutoFlow")}
              />
            </div>
            <AlignmentMatrix
              justify={GRID_TO_FLEX[String(layout["justifyItems"] ?? "")] ?? "flex-start"}
              align={GRID_TO_FLEX[String(layout["alignItems"] ?? "")] ?? "stretch"}
              onChange={(j, a) => {
                // grid uses start/center/end keywords (not flex-start/flex-end).
                set("layout", "justifyItems", FLEX_TO_GRID[j] ?? j);
                set("layout", "alignItems", FLEX_TO_GRID[a] ?? a);
              }}
            />
          </>
        )}

        {!isFlex && !isGrid && (
          <p className="text-[11px] text-muted-foreground">
            Set Display to flex or grid for the visual alignment editor.
          </p>
        )}
      </FullGroup>

      {/* ------------------------------------------------------------- Size */}
      <FullGroup
        title="Size"
        help="Set how wide and tall this block is. Leave blank for automatic. You can use px, % or leave as “auto”."
      >
        {measured && (
          <div className="flex items-center justify-between rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground">
            <span>
              Current: <span className="tabular-nums text-foreground">{measured.w}</span> ×{" "}
              <span className="tabular-nums text-foreground">{measured.h}</span> px
            </span>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 font-medium text-primary hover:bg-muted"
              onClick={() => {
                set("sizing", "width", `${measured.w}px`);
                set("sizing", "height", `${measured.h}px`);
              }}
            >
              Use
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <DimensionField
            label="Width"
            value={sizing["width"]}
            placeholder={measured ? `${measured.w}px` : "auto"}
            onChange={(v) => set("sizing", "width", v)}
            {...ov("sizing", "width")}
          />
          <DimensionField
            label="Height"
            value={sizing["height"]}
            placeholder={measured ? `${measured.h}px` : "auto"}
            onChange={(v) => set("sizing", "height", v)}
            {...ov("sizing", "height")}
          />
          <DimensionField
            label="Min width"
            value={sizing["minWidth"]}
            onChange={(v) => set("sizing", "minWidth", v)}
            {...ov("sizing", "minWidth")}
          />
          <DimensionField
            label="Max width"
            value={sizing["maxWidth"]}
            onChange={(v) => set("sizing", "maxWidth", v)}
            {...ov("sizing", "maxWidth")}
          />
          <DimensionField
            label="Min height"
            value={sizing["minHeight"]}
            onChange={(v) => set("sizing", "minHeight", v)}
            {...ov("sizing", "minHeight")}
          />
          <DimensionField
            label="Max height"
            value={sizing["maxHeight"]}
            onChange={(v) => set("sizing", "maxHeight", v)}
            {...ov("sizing", "maxHeight")}
          />
        </div>
        <OptionField
          label="Overflow"
          help="What happens when content is bigger than the block — clip it or add scrollbars."
          value={String(advanced["overflow"] ?? "")}
          options={OVERFLOW_OPTIONS}
          onChange={(v) => set("advanced", "overflow", v)}
          {...ov("advanced", "overflow")}
        />
        {showAdvanced && (
          <OptionField
            label="Mouse cursor"
            help="How the cursor looks when hovering over this block."
            value={String(advanced["cursor"] ?? "")}
            options={CURSOR_OPTIONS}
            labels={CURSOR_LABELS}
            onChange={(v) => set("advanced", "cursor", v)}
            {...ov("advanced", "cursor")}
          />
        )}
        {!isOverride && !isState && (
          <label className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
            <span className="text-[11px]">
              Fluid auto-scaling
              <span className="block text-[10px] text-muted-foreground">
                Off = apply your exact width / height
              </span>
            </span>
            <Switch
              checked={styles["autoResponsive"] !== false}
              onCheckedChange={(v) => update(`${rootPath}.autoResponsive`, v ? undefined : false)}
            />
          </label>
        )}
      </FullGroup>

      {/* --------------------------------------------------------- Position */}
      <FullGroup
        title="Placement"
        help="Pin this block in a fixed spot or make it stick while scrolling — great for sticky navbars."
      >
        <OptionField
          label="Placement type"
          help="Normal = flows with the page. Sticky/Fixed = stays put as you scroll."
          value={positionValue}
          options={POSITION_OPTIONS}
          onChange={(v) => set("position", "position", v)}
          {...ov("position", "position")}
        />
        {positionValue === "sticky" && (
          <p className="text-[11px] text-muted-foreground">
            Sticky pins the element while its scroll container is in view — set an offset
            (e.g. Top&nbsp;0) for a sticky navbar.
          </p>
        )}
        {positioned && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <DimensionField
                label="Top"
                value={position["top"]}
                onChange={(v) => set("position", "top", v)}
                {...ov("position", "top")}
              />
              <DimensionField
                label="Right"
                value={position["right"]}
                onChange={(v) => set("position", "right", v)}
                {...ov("position", "right")}
              />
              <DimensionField
                label="Bottom"
                value={position["bottom"]}
                onChange={(v) => set("position", "bottom", v)}
                {...ov("position", "bottom")}
              />
              <DimensionField
                label="Left"
                value={position["left"]}
                onChange={(v) => set("position", "left", v)}
                {...ov("position", "left")}
              />
            </div>
            <NumberField
              label="Layer order"
              help="Higher numbers appear on top of other blocks."
              value={position["zIndex"]}
              onChange={(v) => set("position", "zIndex", v)}
              {...ov("position", "zIndex")}
            />
          </>
        )}
      </FullGroup>
      </>
      )}

      {showVisual && (
      <>
      <Group
        title="Images & Media"
        help="How images fill their box and which part stays in view when cropped."
      >
        <div className="grid grid-cols-2 gap-2">
          <OptionField
            label="Image fit"
            help="How an image fills its box. “Cover” crops to fill; “Contain” shows the whole image."
            value={String(advanced["objectFit"] ?? mediaEffects["objectFit"] ?? "")}
            options={OBJECT_FIT_OPTIONS}
            labels={OBJECT_FIT_LABELS}
            onChange={(v) => set("advanced", "objectFit", v)}
            {...ov("advanced", "objectFit")}
          />
          <OptionField
            label="Image focus point"
            help="Which part of the image to keep in view when it's cropped (e.g. top, center)."
            value={String(mediaEffects["objectPosition"] ?? "")}
            options={OBJECT_POSITION_OPTIONS}
            onChange={(v) => set("mediaEffects", "objectPosition", v)}
            {...ov("mediaEffects", "objectPosition")}
          />
        </div>
        <DimensionField
          label="Aspect ratio"
          help="Lock width-to-height ratio (e.g. 16/9, 4/3, 1/1)."
          value={sizing["aspectRatio"]}
          placeholder="auto"
          onChange={(v) => set("sizing", "aspectRatio", v)}
          {...ov("sizing", "aspectRatio")}
        />
      </Group>

      {/* ----------------------------------------------------------- Border */}
      <Group title="Border & Corners" help="Outline style, solid or gradient border color, thickness, and corner radius.">
        <SidesField
          label="Rounded corners"
          help="How round the corners are. Link rounds all four; unlink to round just one corner."
          group="borders"
          scale={SPACING_SCALE}
          values={borders}
          set={set}
          reset={reset}
          overridden={overridden}
          linked={[{ label: "All corners", keys: ["borderRadius"] }]}
          sides={[
            { label: "Top-left", key: "borderTopLeftRadius" },
            { label: "Top-right", key: "borderTopRightRadius" },
            { label: "Bottom-right", key: "borderBottomRightRadius" },
            { label: "Bottom-left", key: "borderBottomLeftRadius" },
          ]}
        />
        <OptionField
          label="Border line style"
          value={String(borders["borderStyle"] ?? "")}
          options={BORDER_STYLES}
          onChange={(v) => set("borders", "borderStyle", v)}
          {...ov("borders", "borderStyle")}
        />
        <GradientOrSolidField
          toggleLabel="Border fill"
          isGradient={isBorderGradient}
          onSelectMode={(mode) => {
            if (mode === "gradient") {
              setObject("borders", "gradient", DEFAULT_STYLE_GRADIENT);
              if (!borders["borderWidth"] && !borders["borderTopWidth"]) {
                set("borders", "borderWidth", 2);
              }
            } else {
              setObject("borders", "gradient", undefined);
            }
          }}
          gradientControl={
            <GradientBuilder
              gradient={borderGradient}
              onChange={(g) => setObject("borders", "gradient", g)}
            />
          }
          solidControl={
            <ColorSidesField
              label="Border color"
              help="Link uses one colour for the whole border; unlink to colour each side."
              group="borders"
              values={borders}
              set={set}
              reset={reset}
              overridden={overridden}
              linkedKey="borderColor"
              sides={[
                { label: "Top", key: "borderTopColor" },
                { label: "Right", key: "borderRightColor" },
                { label: "Bottom", key: "borderBottomColor" },
                { label: "Left", key: "borderLeftColor" },
              ]}
            />
          }
        />
        <SidesField
          label="Border thickness"
          help="How thick the outline is. Link for all sides; unlink to border just one side."
          group="borders"
          scale={BORDER_WIDTH_SCALE}
          values={borders}
          set={set}
          reset={reset}
          overridden={overridden}
          linked={[{ label: "All sides", keys: ["borderWidth"] }]}
          sides={[
            { label: "Top", key: "borderTopWidth" },
            { label: "Right", key: "borderRightWidth" },
            { label: "Bottom", key: "borderBottomWidth" },
            { label: "Left", key: "borderLeftWidth" },
          ]}
        />
      </Group>

      {/* --- Advanced sections: hidden in Simple mode to reduce clutter --- */}
      {showAdvanced && (
        <>
          {/* --------------------------------------------------------- Shadow */}
          <FullGroup title="Shadow" help="Add a soft drop shadow to lift the block off the page.">
            <ShadowBuilder
              value={String(shadows["boxShadow"] ?? "")}
              onChange={(v) => set("shadows", "boxShadow", v)}
            />
            <DimensionField
              label="Text shadow"
              help="Shadow behind letters (e.g. 0 2px 4px rgba(0,0,0,0.2))."
              value={shadows["textShadow"]}
              placeholder="none"
              onChange={(v) => set("shadows", "textShadow", v)}
              {...ov("shadows", "textShadow")}
            />
          </FullGroup>

      {/* ----------------------------------------------------------- Filter */}
      <FullGroup title="Visual Effects" help="Blur, brighten, add contrast, or fade the block.">

        <SliderRow
          label="Blur"
          value={numOr(effects["blur"], 0)}
          min={0}
          max={40}
          unit="px"
          onChange={(v) => set("effects", "blur", v || undefined)}
        />
        <SliderRow
          label="Brightness"
          value={numOr(effects["brightness"], 100)}
          min={0}
          max={200}
          unit="%"
          onChange={(v) => set("effects", "brightness", v === 100 ? undefined : v)}
        />
        <SliderRow
          label="Contrast"
          value={numOr(effects["contrast"], 100)}
          min={0}
          max={200}
          unit="%"
          onChange={(v) => set("effects", "contrast", v === 100 ? undefined : v)}
        />
        <SliderRow
          label="Saturate"
          value={numOr(effects["saturate"], 100)}
          min={0}
          max={200}
          unit="%"
          onChange={(v) => set("effects", "saturate", v === 100 ? undefined : v)}
        />
        <SliderRow
          label="Grayscale"
          value={numOr(effects["grayscale"], 0)}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => set("effects", "grayscale", v || undefined)}
        />
        <SliderRow
          label="Opacity"
          value={Math.round(numOr(effects["opacity"], 1) * 100)}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => set("effects", "opacity", v === 100 ? undefined : v / 100)}
        />
        <OptionField
          label="Blend mode"
          help="How this block blends with content behind it."
          value={String(advanced["mixBlendMode"] ?? "")}
          options={["", "normal", "multiply", "screen", "overlay", "darken", "lighten"]}
          labels={["Default", "Normal", "Multiply", "Screen", "Overlay", "Darken", "Lighten"]}
          onChange={(v) => set("advanced", "mixBlendMode", v)}
          {...ov("advanced", "mixBlendMode")}
        />
      </FullGroup>

      {/* -------------------------------------------------------- Transform */}
      <FullGroup
        title="Move & Rotate"
        help="Nudge, scale, rotate or skew the block without changing the layout around it."
        action={
          <ResetButton
            title="Reset transform"
            onClick={() => setObject("effects", "transform", undefined)}
          />
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Shift sideways"
            value={transform["translateX"]}
            onChange={(v) => setObject("effects", "transform", { ...transform, translateX: v })}
          />
          <NumberField
            label="Shift up/down"
            value={transform["translateY"]}
            onChange={(v) => setObject("effects", "transform", { ...transform, translateY: v })}
          />
        </div>
        <SliderRow
          label="Size scale"
          value={Math.round(numOr(transform["scale"], 1) * 100)}
          min={0}
          max={200}
          unit="%"
          onChange={(v) =>
            setObject("effects", "transform", { ...transform, scale: v === 100 ? undefined : v / 100 })
          }
        />
        <SliderRow
          label="Rotate"
          value={numOr(transform["rotate"], 0)}
          min={-180}
          max={180}
          unit="°"
          onChange={(v) =>
            setObject("effects", "transform", { ...transform, rotate: v || undefined })
          }
        />
        {/* Full-width rows — a 2-col grid squeezes the slider so the label
            overlaps the track in the narrow panel. */}
        <SliderRow
          label="Tilt sideways"
          value={numOr(transform["skewX"], 0)}
          min={-45}
          max={45}
          unit="°"
          onChange={(v) =>
            setObject("effects", "transform", { ...transform, skewX: v || undefined })
          }
        />
        <OptionField
          label="Transform anchor"
          help="The point the block rotates or scales from (e.g. center, top left)."
          value={String(effects["transformOrigin"] ?? "center center")}
          options={[
            "center center",
            "top left",
            "top center",
            "top right",
            "center left",
            "center right",
            "bottom left",
            "bottom center",
            "bottom right",
          ]}
          onChange={(v) => set("effects", "transformOrigin", v === "center center" ? undefined : v)}
          {...ov("effects", "transformOrigin")}
        />
        <SliderRow
          label="Tilt vertically"
          value={numOr(transform["skewY"], 0)}
          min={-45}
          max={45}
          unit="°"
          onChange={(v) =>
            setObject("effects", "transform", { ...transform, skewY: v || undefined })
          }
        />
      </FullGroup>

      {/* ------------------------------------------------------- Transitions */}
      <FullGroup
        title="Smooth Transitions"
        help="Make appearance changes (like hover effects) animate smoothly instead of snapping."
      >
        <div className="grid grid-cols-2 gap-2">
          <OptionField
            label="What animates"
            value={String(interaction["transitionProperty"] ?? "")}
            options={TRANSITION_PROPERTIES}
            onChange={(v) => set("interaction", "transitionProperty", v)}
          />
          <OptionField
            label="Motion curve"
            value={String(interaction["transitionTiming"] ?? "")}
            options={TRANSITION_TIMINGS}
            onChange={(v) => set("interaction", "transitionTiming", v)}
          />
          <NumberStepField
            label="Duration (s)"
            value={interaction["transitionDuration"]}
            step={0.05}
            onChange={(v) => set("interaction", "transitionDuration", v)}
          />
          <NumberStepField
            label="Delay (s)"
            value={interaction["transitionDelay"]}
            step={0.05}
            onChange={(v) => set("interaction", "transitionDelay", v)}
          />
        </div>
      </FullGroup>
        </>
      )}
      </>
      )}
    </div>
    </TokenOnlyColorContext.Provider>
  );
});
StyleControls.displayName = "StyleControls";

/* ================================================================== */
/* Switchers & layout primitives                                      */
/* ================================================================== */

const DeviceSwitcher: React.FC<{
  value: Breakpoint;
  onChange: (b: Breakpoint) => void;
}> = ({ value, onChange }) => (
  <div className="grid grid-cols-5 gap-1 rounded-md bg-muted p-1">
    {DEVICES.map((d) => (
      <button
        key={d.key}
        type="button"
        onClick={() => onChange(d.key)}
        title={d.label}
        className={`flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[11px] font-medium transition-colors ${
          value === d.key
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {d.icon}
        {d.label}
      </button>
    ))}
  </div>
);

const StateSwitcher: React.FC<{
  value: StateKey;
  onChange: (s: StateKey) => void;
}> = ({ value, onChange }) => (
  <div className="grid grid-cols-5 gap-1 rounded-md bg-muted p-1">
    {STATES.map((s) => (
      <button
        key={s.key}
        type="button"
        onClick={() => onChange(s.key)}
        title={s.key === "default" ? "Normal look" : `${STATE_PSEUDO[s.key]} look`}
        className={`flex items-center justify-center rounded px-1.5 py-1.5 text-[11px] font-medium transition-colors ${
          value === s.key
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {s.label}
      </button>
    ))}
  </div>
);

/** Group heading + optional Help-mode explanation shown under the title. */
const GroupHeading: React.FC<{ title: string; help?: string; action?: React.ReactNode }> = ({
  title,
  help,
  action,
}) => {
  const helpMode = useEditorUiStore((s) => s.helpMode);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        {action}
      </div>
      {helpMode && help && <p className="text-[10px] leading-snug text-muted-foreground">{help}</p>}
    </div>
  );
};

const Group: React.FC<{ title: string; help?: string; children: React.ReactNode }> = ({
  title,
  help,
  children,
}) => (
  <div className="flex flex-col gap-2">
    <GroupHeading title={title} help={help} />
    <div className="grid grid-cols-2 gap-2">{children}</div>
  </div>
);

/** A section whose children span the full panel width (one column). */
const FullGroup: React.FC<{
  title: string;
  help?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, help, action, children }) => (
  <div className="flex flex-col gap-2">
    <GroupHeading title={title} help={help} action={action} />
    <div className="flex flex-col gap-2">{children}</div>
  </div>
);

const ResetButton: React.FC<{ onClick: () => void; title?: string }> = ({ onClick, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title ?? "Reset"}
    className="text-muted-foreground hover:text-foreground"
  >
    <RotateCcw className="h-3 w-3" />
  </button>
);

const Field: React.FC<{
  label: string;
  help?: string;
  overridden?: boolean;
  onReset?: () => void;
  children: React.ReactNode;
}> = ({ label, help, overridden, onReset, children }) => {
  const helpMode = useEditorUiStore((s) => s.helpMode);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1">
          {overridden && (
            <BuilderTip content="This value is overridden on the current device">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            </BuilderTip>
          )}
          {label}
          {help && (
            <BuilderTip content={help}>
              <button
                type="button"
                className="text-muted-foreground/70 transition-colors hover:text-foreground"
                aria-label={`About ${label}`}
              >
                <HelpCircle className="h-3 w-3" />
              </button>
            </BuilderTip>
          )}
        </Label>
        {overridden && onReset && (
          <BuilderTip content="Clear this override and inherit from the base design">
            <ResetButton onClick={onReset} />
          </BuilderTip>
        )}
      </div>
      {helpMode && help && (
        <p className="-mt-0.5 text-[10px] leading-snug text-muted-foreground">{help}</p>
      )}
      {children}
    </div>
  );
};

interface OverrideProps {
  overridden?: boolean;
  onReset?: () => void;
  /** Plain-English explanation shown as a tooltip + under the label in Help mode. */
  help?: string;
}

/* ================================================================== */
/* Field primitives                                                   */
/* ================================================================== */

const SegToggle: React.FC<{
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ value, options, onChange }) => (
  <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-0.5">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
          value === o.value
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const DEFAULT_STYLE_GRADIENT = {
  type: "linear" as const,
  angle: 135,
  stops: [
    { color: "hsl(var(--primary))", position: 0 },
    { color: "hsl(var(--accent))", position: 100 },
  ],
};

const GradientOrSolidField: React.FC<{
  toggleLabel: string;
  isGradient: boolean;
  onSelectMode: (mode: "solid" | "gradient") => void;
  gradientControl: React.ReactNode;
  solidControl: React.ReactNode;
}> = ({ toggleLabel, isGradient, onSelectMode, gradientControl, solidControl }) => (
  <>
    <Field label={toggleLabel}>
      <SegToggle
        value={isGradient ? "gradient" : "solid"}
        options={[
          { value: "solid", label: "Solid" },
          { value: "gradient", label: "Gradient" },
        ]}
        onChange={(mode) => onSelectMode(mode as "solid" | "gradient")}
      />
    </Field>
    {isGradient ? gradientControl : solidControl}
  </>
);

/**
 * Compact preview of the currently-applied color: swatch + name (theme token or
 * "Custom") + HEX + RGB — so authors always see exactly what colour is set.
 */
const CurrentColorChip: React.FC<{ value: string }> = ({ value }) => {
  const name =
    value === ""
      ? "None"
      : (COLOR_TOKENS.find((t) => t.value === value)?.label ?? "Custom");
  const parts = React.useMemo(() => resolveColorParts(value), [value]);
  if (!value) return null;
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <span
        className="mt-0.5 h-7 w-7 shrink-0 self-start rounded border border-border"
        style={{ background: value }}
        aria-hidden
      />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-[11px] font-medium text-foreground">{name}</span>
        {parts?.hex && (
          <code className="text-[10px] uppercase text-muted-foreground">{parts.hex}</code>
        )}
        {parts?.rgb && (
          <code className="text-[10px] lowercase text-muted-foreground">{parts.rgb}</code>
        )}
      </div>
    </div>
  );
};

const ColorField: React.FC<
  { label: string; value: string; onChange: (v: string) => void } & OverrideProps
> = ({ label, value, onChange, overridden, onReset, help }) => {
  const tokenOnly = React.useContext(TokenOnlyColorContext);
  const isToken = COLOR_TOKENS.some((t) => t.value === value) || value === "";
  const recent = useRecentColors((s) => s.colors);
  const addRecent = useRecentColors((s) => s.add);
  const saved = useSavedColors((s) => s.colors);
  const pick = (v: string): void => {
    onChange(v);
    addRecent(v);
  };

  return (
    <Field label={label} help={help} overridden={overridden} onReset={onReset}>
      <CurrentColorChip value={value} />

      {!tokenOnly && (
        <ColorPickerRow
          value={value}
          onChange={onChange}
          ariaLabel={`${label} — pick any color`}
          placeholder="#147eff / rgb() / hsl()"
          showBookmark
        />
      )}

      <Select
        value={isToken ? value || "__none" : "__custom"}
        onValueChange={(v) => onChange(v === "__none" ? "" : v === "__custom" ? value || "#147eff" : v)}
      >
        <SelectTrigger className="h-8">
          <SelectValue placeholder="Theme color" />
        </SelectTrigger>
        <SelectContent>
          {COLOR_TOKENS.map((t) => (
            <SelectItem key={t.label} value={t.value || "__none"}>
              {t.label}
            </SelectItem>
          ))}
          {!tokenOnly && <SelectItem value="__custom">Custom (use picker above)</SelectItem>}
        </SelectContent>
      </Select>

      {!tokenOnly && (saved.length > 0 || recent.length > 0) && (
        <div className="mt-1 flex flex-col gap-1">
          {saved.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-0.5 text-[10px] text-muted-foreground">Saved</span>
              {saved.map((c) => (
                <button
                  key={`saved-${c}`}
                  type="button"
                  title={c}
                  onClick={() => pick(c)}
                  className="h-5 w-5 rounded border-2 border-primary/40"
                  style={{ background: c }}
                />
              ))}
            </div>
          )}
          {recent.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-0.5 text-[10px] text-muted-foreground">Recent</span>
              {recent.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => pick(c)}
                  className="h-5 w-5 rounded border border-border"
                  style={{ background: c }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Field>
  );
};

/** Token-scale select with a raw-value escape hatch. */
const ScaleField: React.FC<
  {
    label: string;
    value: unknown;
    scale: { label: string; value: number }[];
    onChange: (v: number) => void;
  } & OverrideProps
> = ({ label, value, scale, onChange, overridden, onReset, help }) => {
  const inScale = scale.some((s) => s.value === Number(value));
  const isSet = value !== undefined && value !== null && value !== "";
  // Sticky "custom" mode: once the user picks "Custom…", keep the raw number
  // input visible even if they type a value that happens to match a scale step
  // (otherwise the field would silently snap back to the dropdown).
  const [rawMode, setRawMode] = React.useState(false);
  const showRaw = rawMode || (isSet && !inScale);
  const selectValue = showRaw ? "__raw" : !isSet ? "__unset" : String(value);
  return (
    <Field label={label} help={help} overridden={overridden} onReset={onReset}>
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === "__unset") return;
          if (v === "__raw") {
            setRawMode(true);
            if (!isSet) onChange(0);
            return;
          }
          setRawMode(false);
          onChange(Number(v));
        }}
      >
        <SelectTrigger className="h-8">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {scale.map((s) => (
            <SelectItem key={s.value} value={String(s.value)}>
              {s.label}
            </SelectItem>
          ))}
          <SelectItem value="__raw">Custom…</SelectItem>
        </SelectContent>
      </Select>
      {showRaw && (
        <div className="mt-1 flex items-center gap-1">
          <Input
            type="number"
            className="h-7"
            autoFocus={rawMode}
            placeholder="e.g. 18"
            value={isSet ? String(value) : ""}
            onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          />
          <span className="text-[10px] text-muted-foreground">px</span>
        </div>
      )}
    </Field>
  );
};

/**
 * Box-model control with a link/unlink toggle. Linked mode shows friendly
 * grouped controls (e.g. "↕ Top/Bottom", "↔ Left/Right"); unlinking reveals one
 * control per side/corner so a user can round only one corner or pad only the
 * left. Writes to the same per-side style keys the renderer already honors.
 */
const SidesField: React.FC<{
  label: string;
  help?: string;
  group: string;
  scale: { label: string; value: number }[];
  values: Record<string, unknown>;
  set: (g: string, k: string, v: number) => void;
  reset: (g: string, k: string) => void;
  overridden: (g: string, k: string) => boolean;
  /** Grouped controls shown when sides are linked (each writes all its keys). */
  linked: { label: string; help?: string; keys: string[] }[];
  /** Individual controls shown when unlinked. */
  sides: { label: string; key: string }[];
}> = ({ label, help, group, scale, values, set, reset, overridden, linked, sides }) => {
  // Auto-expand if the tree already has different per-side values set.
  const hasPerSide = sides.some(
    (s) => !linked.some((l) => l.keys.includes(s.key)) && values[s.key] != null,
  );
  const [perSide, setPerSide] = React.useState(hasPerSide);
  return (
    <div className="col-span-2 flex flex-col gap-2 rounded-md border border-border/60 p-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1 text-[11px] font-medium">
          {label}
          {help && (
            <BuilderTip content={help}>
              <button type="button" className="text-muted-foreground/70 hover:text-foreground" aria-label={`About ${label}`}>
                <HelpCircle className="h-3 w-3" />
              </button>
            </BuilderTip>
          )}
        </Label>
        <BuilderTip content={perSide ? "Link all sides together" : "Set each side separately"}>
          <button
            type="button"
            onClick={() => setPerSide((v) => !v)}
            aria-pressed={perSide}
            className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {perSide ? <Link2 className="h-3 w-3" /> : <Unlink className="h-3 w-3" />}
            {perSide ? "Link sides" : "Each side"}
          </button>
        </BuilderTip>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {perSide
          ? sides.map((s) => (
              <ScaleField
                key={s.key}
                label={s.label}
                value={values[s.key]}
                scale={scale}
                onChange={(v) => set(group, s.key, v)}
                overridden={overridden(group, s.key)}
                onReset={() => reset(group, s.key)}
              />
            ))
          : linked.map((l) => (
              <ScaleField
                key={l.label}
                label={l.label}
                help={l.help}
                value={values[l.keys[0]]}
                scale={scale}
                onChange={(v) => l.keys.forEach((k) => set(group, k, v))}
                overridden={l.keys.some((k) => overridden(group, k))}
                onReset={() => l.keys.forEach((k) => reset(group, k))}
              />
            ))}
      </div>
    </div>
  );
};

/** Per-side COLOR control with a link/unlink toggle (border colours). */
const ColorSidesField: React.FC<{
  label: string;
  help?: string;
  group: string;
  values: Record<string, unknown>;
  set: (g: string, k: string, v: string) => void;
  reset: (g: string, k: string) => void;
  overridden: (g: string, k: string) => boolean;
  linkedKey: string;
  sides: { label: string; key: string }[];
}> = ({ label, help, group, values, set, reset, overridden, linkedKey, sides }) => {
  const hasPerSide = sides.some((s) => values[s.key] != null && values[s.key] !== "");
  const [perSide, setPerSide] = React.useState(hasPerSide);
  return (
    <div className="col-span-2 flex flex-col gap-2 rounded-md border border-border/60 p-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1 text-[11px] font-medium">
          {label}
          {help && (
            <BuilderTip content={help}>
              <button type="button" className="text-muted-foreground/70 hover:text-foreground" aria-label={`About ${label}`}>
                <HelpCircle className="h-3 w-3" />
              </button>
            </BuilderTip>
          )}
        </Label>
        <BuilderTip content={perSide ? "Use one colour for all sides" : "Colour each side separately"}>
          <button
            type="button"
            onClick={() => setPerSide((v) => !v)}
            aria-pressed={perSide}
            className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {perSide ? <Link2 className="h-3 w-3" /> : <Unlink className="h-3 w-3" />}
            {perSide ? "Link sides" : "Each side"}
          </button>
        </BuilderTip>
      </div>
      {perSide ? (
        <div className="flex flex-col gap-2">
          {sides.map((s) => (
            <ColorField
              key={s.key}
              label={s.label}
              value={String(values[s.key] ?? "")}
              onChange={(v) => set(group, s.key, v)}
              overridden={overridden(group, s.key)}
              onReset={() => reset(group, s.key)}
            />
          ))}
        </div>
      ) : (
        <ColorField
          label="All sides"
          value={String(values[linkedKey] ?? "")}
          onChange={(v) => set(group, linkedKey, v)}
          overridden={overridden(group, linkedKey)}
          onReset={() => reset(group, linkedKey)}
        />
      )}
    </div>
  );
};

const OptionField: React.FC<
  {
    label: string;
    value: string;
    options: string[];
    labels?: string[];
    onChange: (v: string) => void;
  } & OverrideProps
> = ({ label, value, options, labels, onChange, overridden, onReset, help }) => (
  <Field label={label} help={help} overridden={overridden} onReset={onReset}>
    <Select value={value || "__unset"} onValueChange={(v) => onChange(v === "__unset" ? "" : v)}>
      <SelectTrigger className="h-8">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt, i) => (
          <SelectItem key={opt} value={opt || "__unset"}>
            {labels?.[i] ?? opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </Field>
);

const FontFamilyField: React.FC<
  { value: string; onChange: (v: string) => void } & OverrideProps
> = ({ value, onChange, overridden, onReset }) => {
  const presetValues = React.useMemo(
    () => new Set(FONT_FAMILIES.map((f) => f.value)),
    [],
  );
  const isCustom = value !== "" && !presetValues.has(value);
  const selectValue = isCustom ? "__custom__" : value || "__theme";

  return (
    <Field label="Font" overridden={overridden} onReset={onReset}>
      <div className="flex flex-col gap-1.5">
        <Select
          value={selectValue}
          onValueChange={(v) => {
            if (v === "__custom__") {
              onChange(isCustom ? value : "inherit, sans-serif");
              return;
            }
            onChange(v === "__theme" ? "" : v);
          }}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Theme font" />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map((f) => (
              <SelectItem key={f.label} value={f.value || "__theme"}>
                {f.label}
              </SelectItem>
            ))}
            <SelectItem value="__custom__">Custom font…</SelectItem>
          </SelectContent>
        </Select>
        {(selectValue === "__custom__" || isCustom) && (
          <Input
            className="h-8 text-xs"
            value={value}
            placeholder={'e.g. "My Brand", Georgia, serif'}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
    </Field>
  );
};

const NumberField: React.FC<
  { label: string; value: unknown; onChange: (v: number) => void } & OverrideProps
> = ({ label, value, onChange, overridden, onReset, help }) => (
  <Field label={label} help={help} overridden={overridden} onReset={onReset}>
    <Input
      type="number"
      className="h-8"
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
    />
  </Field>
);

/** Free-text CSS length input — accepts `auto`, `100`, `100px`, `50%`, `80vh`… */
const DimensionField: React.FC<
  { label: string; value: unknown; placeholder?: string; onChange: (v: string) => void } & OverrideProps
> = ({ label, value, placeholder, onChange, overridden, onReset, help }) => (
  <Field label={label} help={help} overridden={overridden} onReset={onReset}>
    <Input
      className="h-8"
      value={value === undefined || value === null ? "" : String(value)}
      placeholder={placeholder ?? "auto"}
      onChange={(e) => onChange(e.target.value)}
    />
  </Field>
);

const NumberStepField: React.FC<{
  label: string;
  value: unknown;
  step?: number;
  onChange: (v: number | undefined) => void;
}> = ({ label, value, step = 1, onChange }) => (
  <Field label={label}>
    <Input
      type="number"
      step={step}
      className="h-8"
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
    />
  </Field>
);

const SliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, unit, onChange }) => (
  <div className="flex items-center gap-2">
    <Label className="w-20 shrink-0">{label}</Label>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1 flex-1 cursor-pointer accent-primary"
    />
    <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">
      {value}
      {unit}
    </span>
  </div>
);

/* ================================================================== */
/* Visual flex / grid editor                                          */
/* ================================================================== */

/** 3×3 alignment matrix: columns = justify, rows = align. */
const AlignmentMatrix: React.FC<{
  justify: string;
  align: string;
  onChange: (justify: string, align: string) => void;
}> = ({ justify, align, onChange }) => {
  const jIdx = Math.max(0, MATRIX_JUSTIFY.indexOf(justify));
  const aIdx = Math.max(0, MATRIX_ALIGN.indexOf(align));
  return (
    <Field label="Content alignment" help="Horizontal (columns) and vertical (rows) alignment of items inside.">
      <div className="grid grid-cols-3 gap-1 rounded-md border border-border p-1">
        {MATRIX_ALIGN.map((a, r) =>
          MATRIX_JUSTIFY.map((j, c) => {
            const active = r === aIdx && c === jIdx;
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                title={`${j} / ${a}`}
                onClick={() => onChange(j, a)}
                className={`flex h-7 items-center justify-center rounded transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <AlignStartVertical className="h-3 w-3" style={{ opacity: active ? 1 : 0.4 }} />
              </button>
            );
          }),
        )}
      </div>
    </Field>
  );
};

/** Add / remove / edit grid tracks. Round-trips a `gridTemplate*` string. */
const GridTrackEditor: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => {
  const tracks = React.useMemo(
    () => (value.trim() ? value.trim().split(/\s+/) : []),
    [value],
  );
  const write = (next: string[]): void => onChange(next.join(" "));
  return (
    <Field label={label}>
      <div className="flex flex-col gap-1">
        {tracks.map((t, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="w-4 text-center text-muted-foreground">{i + 1}</span>
            <Select
              value={GRID_TRACK_PRESETS.includes(t) ? t : "__raw"}
              onValueChange={(v) => {
                const next = [...tracks];
                next[i] = v === "__raw" ? t : v;
                write(next);
              }}
            >
              <SelectTrigger className="h-7 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRID_TRACK_PRESETS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
                <SelectItem value="__raw">Custom…</SelectItem>
              </SelectContent>
            </Select>
            {!GRID_TRACK_PRESETS.includes(t) && (
              <Input
                className="h-7 w-16"
                value={t}
                placeholder="120px"
                onChange={(e) => {
                  const next = [...tracks];
                  next[i] = e.target.value || "1fr";
                  write(next);
                }}
              />
            )}
            <button
              type="button"
              title="Remove track"
              onClick={() => write(tracks.filter((_, k) => k !== i))}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => write([...tracks, "1fr"])}
          className="flex items-center justify-center gap-1 rounded border border-dashed border-border py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add {label.toLowerCase().slice(0, -1)}
        </button>
      </div>
    </Field>
  );
};

/* ================================================================== */
/* Gradient builder                                                   */
/* ================================================================== */

interface GradientStop {
  color: string;
  position: number;
}

/** Compact color picker for a single gradient stop (theme token or any custom color). */
const GradientStopColor: React.FC<{
  value: string;
  onChange: (color: string) => void;
}> = ({ value, onChange }) => {
  const tokenOnly = React.useContext(TokenOnlyColorContext);
  const isToken = COLOR_TOKENS.some((t) => t.value === value) || value === "";

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      {!tokenOnly && (
        <ColorPickerRow
          compact
          value={value}
          onChange={onChange}
          ariaLabel="Pick gradient stop color"
          placeholder="#147eff"
        />
      )}
      <Select
        value={isToken ? value || "__none" : "__custom"}
        onValueChange={(v) => onChange(v === "__none" ? "" : v === "__custom" ? value || "#147eff" : v)}
      >
        <SelectTrigger className="h-7">
          <SelectValue placeholder="Theme token" />
        </SelectTrigger>
        <SelectContent>
          {COLOR_TOKENS.map((t) => (
            <SelectItem key={t.label} value={t.value || "__none"}>
              {t.label}
            </SelectItem>
          ))}
          {!tokenOnly && <SelectItem value="__custom">Custom (use picker)</SelectItem>}
        </SelectContent>
      </Select>
    </div>
  );
};

const GradientBuilder: React.FC<{
  gradient: Dict;
  onChange: (g: Dict) => void;
}> = ({ gradient, onChange }) => {
  const type = String(gradient["type"] ?? "linear");
  const angle = numOr(gradient["angle"], 135);
  const stops = (Array.isArray(gradient["stops"]) ? gradient["stops"] : []) as GradientStop[];

  const patch = (p: Partial<Dict>): void => onChange({ ...gradient, ...p });
  const setStops = (next: GradientStop[]): void => patch({ stops: next });

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2">
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] text-muted-foreground">Preset gradients</Label>
        <div className="grid grid-cols-3 gap-1">
          {GRADIENT_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              title={p.label}
              onClick={() =>
                onChange({ type: p.type, angle: p.angle, stops: p.stops.map((s) => ({ ...s })) })
              }
              className="h-7 rounded border border-border text-[10px] font-medium text-white/90 shadow-sm"
              style={{ backgroundImage: gradientPresetToCss(p) }}
            >
              <span className="rounded bg-black/25 px-1 py-0.5">{p.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Type">
          <Select value={type} onValueChange={(v) => patch({ type: v })}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRADIENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {type !== "radial" && (
          <Field label={`Angle (${angle}°)`}>
            <input
              type="range"
              min={0}
              max={360}
              value={angle}
              onChange={(e) => patch({ angle: Number(e.target.value) })}
              className="h-1 w-full cursor-pointer accent-primary"
            />
          </Field>
        )}
      </div>

      <div
        className="h-8 w-full rounded border border-border"
        style={{
          backgroundImage: buildGradientCss(gradient) ?? undefined,
        }}
      />

      <div className="flex flex-col gap-2">
        <Label className="text-[10px] text-muted-foreground">Color stops — pick theme tokens or any custom color</Label>
        {stops.map((s, i) => (
          <div key={i} className="flex items-start gap-1">
            <GradientStopColor
              value={s.color}
              onChange={(color) => {
                const next = [...stops];
                next[i] = { ...s, color };
                setStops(next);
              }}
            />
            <Input
              type="number"
              min={0}
              max={100}
              className="h-7 w-14 shrink-0"
              value={s.position}
              onChange={(e) => {
                const next = [...stops];
                next[i] = { ...s, position: Number(e.target.value) };
                setStops(next);
              }}
            />
            <span className="pt-1.5 text-[10px] text-muted-foreground">%</span>
            <button
              type="button"
              title="Remove stop"
              disabled={stops.length <= 2}
              onClick={() => setStops(stops.filter((_, k) => k !== i))}
              className="mt-1 text-muted-foreground hover:text-destructive disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setStops([...stops, { color: "hsl(var(--accent))", position: 50 }])}
          className="flex items-center justify-center gap-1 rounded border border-dashed border-border py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add stop
        </button>
      </div>
    </div>
  );
};

/* ================================================================== */
/* Multi-shadow builder                                               */
/* ================================================================== */

const ShadowBuilder: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => {
  const layers = React.useMemo<ShadowLayer[]>(() => parseShadowLayers(value), [value]);
  const write = (next: ShadowLayer[]): void =>
    onChange(next.length ? shadowsToCss(next) : "");
  const patch = (i: number, p: Partial<ShadowLayer>): void => {
    const next = layers.map((l, k) => (k === i ? { ...l, ...p } : l));
    write(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {SHADOW_LAYER_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => write([p.layer])}
            className="rounded border border-border px-2 py-1 text-[11px] hover:bg-muted"
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => write([])}
          className="rounded border border-border px-2 py-1 text-[11px] hover:bg-muted"
        >
          none
        </button>
      </div>

      {layers.map((l, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-md border border-border p-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Layer {i + 1}</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[11px]">
                <input
                  type="checkbox"
                  checked={l.inset}
                  onChange={(e) => patch(i, { inset: e.target.checked })}
                />
                inset
              </label>
              <button
                type="button"
                title="Remove layer"
                onClick={() => write(layers.filter((_, k) => k !== i))}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {(["x", "y", "blur", "spread"] as const).map((k) => (
              <div key={k} className="flex flex-col gap-0.5">
                <Label className="text-[10px] capitalize">{k}</Label>
                <Input
                  type="number"
                  className="h-7"
                  value={String(l[k])}
                  onChange={(e) => patch(i, { [k]: Number(e.target.value) } as Partial<ShadowLayer>)}
                />
              </div>
            ))}
          </div>
          <ColorPickerRow
            compact
            value={l.color}
            onChange={(color) => patch(i, { color })}
            ariaLabel="Shadow color"
            placeholder="rgba(0,0,0,0.15)"
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          write([...layers, { x: 0, y: 4, blur: 12, spread: 0, color: "rgba(0,0,0,0.12)", inset: false }])
        }
        className="flex items-center justify-center gap-1 rounded border border-dashed border-border py-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3 w-3" /> Add shadow layer
      </button>
    </div>
  );
};
