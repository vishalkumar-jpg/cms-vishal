import * as React from "react";
import {
  Sparkles,
  Ban,
  Eye,
  MoveUp,
  ZoomIn,
  Zap,
  Hand,
  MousePointerClick,
  Timer,
  Rss,
  RotateCw,
  FlipHorizontal,
  Activity,
  Vibrate,
  Play,
  Copy,
  ClipboardPaste,
} from "lucide-react";
import {
  ANIMATION_TRIGGERS,
  ANIMATION_EASINGS,
  HOVER_PRESETS,
  defaultTriggerFor,
  type AnimationPreset,
  type AnimationTrigger,
} from "@ob-cms/block-schema";
import { Label, Input, Button } from "@/components/ui";
import { Switch } from "@/components/ui/switch";
import { useUpdateProp } from "./useUpdateProp";
import { useEditorUiStore } from "../store/editorUiStore";

/**
 * Interactions / Motion panel — authors a node's animations.
 *
 * Two layers, both stored under `styles.interactions` and resolved by the SAME
 * `interactionCssVars()` → `cssFromStyles()` path (editor ↔ renderer parity,
 * SSR-safe, emits nothing when unset):
 *
 *   1. ANIMATION PRESETS (this panel's hero) — a one-click gallery. Each card
 *      applies `interactions.animation = { preset, trigger }` in a single click.
 *      Presets: fade in, slide up, zoom in, glow (hover), lift (hover).
 *      Triggers: hover, click, load, scroll.
 *   2. Parallax — a raw scroll-speed knob for backgrounds/decorations.
 */

type Dict = Record<string, unknown>;
const asDict = (v: unknown): Dict => (v && typeof v === "object" ? (v as Dict) : {});
const numOr = (v: unknown, d: number): number =>
  v == null || v === "" || Number.isNaN(Number(v)) ? d : Number(v);

interface PresetMeta {
  value: Exclude<AnimationPreset, "none">;
  label: string;
  icon: React.ReactNode;
  hint: string;
}

const PRESETS: PresetMeta[] = [
  { value: "fade-in", label: "Fade in", icon: <Eye className="h-4 w-4" />, hint: "Softly fades into view" },
  { value: "slide-up", label: "Slide up", icon: <MoveUp className="h-4 w-4" />, hint: "Rises up while fading in" },
  { value: "zoom-in", label: "Zoom in", icon: <ZoomIn className="h-4 w-4" />, hint: "Scales up into view" },
  { value: "bounce-in", label: "Bounce", icon: <Activity className="h-4 w-4" />, hint: "Bounces in from below" },
  { value: "rotate-in", label: "Rotate", icon: <RotateCw className="h-4 w-4" />, hint: "Rotates while appearing" },
  { value: "flip-in", label: "Flip", icon: <FlipHorizontal className="h-4 w-4" />, hint: "Flips into view" },
  { value: "glow-hover", label: "Glow", icon: <Zap className="h-4 w-4" />, hint: "Glows on hover" },
  { value: "lift-hover", label: "Lift", icon: <Hand className="h-4 w-4" />, hint: "Lifts up on hover" },
  { value: "pulse-hover", label: "Pulse", icon: <Activity className="h-4 w-4" />, hint: "Pulses on hover" },
  { value: "shake-hover", label: "Shake", icon: <Vibrate className="h-4 w-4" />, hint: "Shakes on hover" },
];

const TRIGGER_META: Record<AnimationTrigger, { label: string; icon: React.ReactNode; hint: string }> = {
  hover: { label: "Hover", icon: <MousePointerClick className="h-3.5 w-3.5" />, hint: "Plays when pointer is over it" },
  click: { label: "Click", icon: <Hand className="h-3.5 w-3.5" />, hint: "Plays on click / tap" },
  load: { label: "Load", icon: <Timer className="h-3.5 w-3.5" />, hint: "Plays as the page loads" },
  scroll: { label: "Scroll", icon: <Rss className="h-3.5 w-3.5" />, hint: "Plays when scrolled into view" },
};

interface InteractionsControlsProps {
  nodeId: string;
  styles: Record<string, unknown>;
}

export const InteractionsControls: React.FC<InteractionsControlsProps> = ({ nodeId, styles }) => {
  const update = useUpdateProp(nodeId);
  const animationClipboard = useEditorUiStore((s) => s.animationClipboard);
  const setAnimationClipboard = useEditorUiStore((s) => s.setAnimationClipboard);

  const interactions = asDict(styles.interactions);
  const animation = asDict(interactions.animation);
  const parallax = asDict(interactions.parallax);

  const preset = (animation.preset as AnimationPreset) || "none";
  const trigger =
    (animation.trigger as AnimationTrigger) ||
    (preset !== "none" ? defaultTriggerFor(preset) : "scroll");
  const duration = numOr(animation.duration, 0.6);
  const delay = numOr(animation.delay, 0);
  const stagger = numOr(animation.stagger, 0);
  const easing = String(animation.easing ?? "ease");
  const once = animation.once !== false; // default true
  const speed = numOr(parallax.speed, 0);

  const isHoverPreset = preset !== "none" && HOVER_PRESETS.has(preset);
  const isEntrancePreset = preset !== "none" && !isHoverPreset;

  const setAnim = (key: string, value: unknown): void =>
    update(`styles.interactions.animation.${key}`, value);

  /** Apply a preset in ONE click: sets both preset + its natural trigger. */
  const applyPreset = (next: PresetMeta["value"]): void => {
    if (preset === next) {
      // Toggle off → clear the whole animation shape.
      update("styles.interactions.animation", undefined);
      return;
    }
    update("styles.interactions.animation", {
      preset: next,
      trigger: defaultTriggerFor(next),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        Animation
      </div>

      {/* ── Preset gallery — one-click apply ─────────────────────────── */}
      <div className="space-y-3 rounded-md border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Choose an animation</p>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[10px]"
              title="Preview on canvas (scroll into view or hover)"
              onClick={() => {
                try {
                  const el = document.querySelector(`[data-craftjs-node="${nodeId}"]`) as HTMLElement | null;
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                  el?.classList.add("ob-anim-run");
                  window.setTimeout(() => el?.classList.remove("ob-anim-run"), 1200);
                } catch {
                  /* ignore */
                }
              }}
            >
              <Play className="mr-1 h-3 w-3" />
              Preview
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[10px]"
              title="Copy animation settings"
              disabled={preset === "none"}
              onClick={() => setAnimationClipboard({ ...animation })}
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[10px]"
              title="Paste animation settings"
              disabled={!animationClipboard}
              onClick={() =>
                update("styles.interactions.animation", { ...animationClipboard })
              }
            >
              <ClipboardPaste className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <PresetCard
            active={preset === "none"}
            icon={<Ban className="h-4 w-4" />}
            label="None"
            onClick={() => update("styles.interactions.animation", undefined)}
          />
          {PRESETS.map((p) => (
            <PresetCard
              key={p.value}
              active={preset === p.value}
              icon={p.icon}
              label={p.label}
              hint={p.hint}
              onClick={() => applyPreset(p.value)}
            />
          ))}
        </div>

        {preset !== "none" && (
          <>
            {/* ── Trigger picker ───────────────────────────────────── */}
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs">Trigger</Label>
              <div className="grid grid-cols-4 gap-1 rounded-md bg-muted p-1">
                {ANIMATION_TRIGGERS.map((t) => {
                  // Continuous hover presets only make sense on hover.
                  const disabled = isHoverPreset && t !== "hover";
                  const meta = TRIGGER_META[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={disabled}
                      title={disabled ? "This preset only runs on hover" : meta.hint}
                      onClick={() => setAnim("trigger", t)}
                      className={`flex flex-col items-center gap-0.5 rounded px-1 py-1.5 text-[10px] font-medium transition-colors ${
                        trigger === t
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                    >
                      {meta.icon}
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Timing ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Duration (s)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  className="h-8 text-xs"
                  value={duration}
                  onChange={(e) => setAnim("duration", numOr(e.target.value, 0.6))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Delay (s)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  className="h-8 text-xs"
                  value={delay}
                  onChange={(e) => setAnim("delay", numOr(e.target.value, 0))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs" title="Delay between sibling animations">
                  Stagger (s)
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.05}
                  className="h-8 text-xs"
                  value={stagger}
                  onChange={(e) => setAnim("stagger", numOr(e.target.value, 0) || undefined)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Easing</Label>
                <select
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                  value={easing}
                  onChange={(e) => setAnim("easing", e.target.value)}
                  aria-label="Animation easing"
                >
                  {ANIMATION_EASINGS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isEntrancePreset && trigger === "scroll" && (
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  Animate once
                  <span className="block text-[10px] font-normal text-muted-foreground">
                    Off = replays every time it re-enters
                  </span>
                </Label>
                <Switch checked={once} onCheckedChange={(v) => setAnim("once", v)} />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Parallax ─────────────────────────────────────────────────── */}
      <div className="space-y-3 rounded-md border border-border p-3">
        <p className="text-xs font-medium text-muted-foreground">Parallax</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Speed (−1 … 1)</Label>
          <Input
            type="number"
            min={-1}
            max={1}
            step={0.05}
            className="h-8 text-xs"
            value={speed}
            onChange={(e) =>
              update("styles.interactions.parallax.speed", numOr(e.target.value, 0))
            }
          />
          <p className="text-[11px] text-muted-foreground">
            0 disables. Positive moves with scroll, negative against it.
          </p>
        </div>
      </div>
    </div>
  );
};

const PresetCard: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}> = ({ active, icon, label, hint, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title={hint}
    aria-pressed={active}
    className={`flex flex-col items-center justify-center gap-1 rounded-md border px-1 py-2.5 text-center transition-colors ${
      active
        ? "border-primary bg-primary/10 text-foreground"
        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
    }`}
  >
    <span className={active ? "text-primary" : ""}>{icon}</span>
    <span className="text-[10px] font-medium leading-tight">{label}</span>
  </button>
);
