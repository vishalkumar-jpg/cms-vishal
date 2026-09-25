import * as React from "react";
import { useEditor } from "@craftjs/core";
import { Sparkles, Loader2, ChevronRight } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import {
  aiAltText,
  aiErrorMessage,
  aiTextOp,
  type TextOp,
  type Tone,
} from "../ai/aiApi";
import {
  IMAGE_ALT_PROP,
  IMAGE_BLOCK,
  IMAGE_URL_PROP,
  resolveTextTarget,
  supportsTextAi,
} from "../ai/textProps";

/**
 * In-canvas AI assist affordance (✨ AI). A floating pill pinned to the
 * top-left of the selected block (mirrors {@link InlineBlockToolbar}'s tracking,
 * which sits top-right). Opening it reveals text operations (Rewrite, Shorten,
 * Expand, Fix grammar, Change tone, Translate) for text blocks, and "Generate
 * alt text" for Image blocks.
 *
 * Every transform calls the SYNC `/ai/*` endpoint and writes the result back via
 * Craft's `setProp` — so it flows through autosave + undo/redo exactly like
 * manual edits. Works offline when AI_MOCK=true; a missing BYOK key surfaces the
 * provider's "add an AI key in Settings" message as a toast.
 */

const TONES: { value: Tone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "bold", label: "Bold" },
  { value: "concise", label: "Concise" },
];

const LANGUAGES = ["Spanish", "French", "German", "Portuguese", "Japanese", "Hindi"];

type SubMenu = null | "tone" | "translate";

export const AiBlockMenu: React.FC = () => {
  const { actions, selectedId, dom, displayName, props } = useEditor((state, query) => {
    const ids = query.getEvent("selected").all();
    const id = ids.length > 0 ? ids[ids.length - 1] : null;
    const node = id ? state.nodes[id] : undefined;
    return {
      selectedId: id,
      dom: node?.dom ?? null,
      displayName: node?.data.displayName ?? node?.data.name ?? "",
      props: (node?.data.props ?? {}) as Record<string, unknown>,
    };
  });

  const [open, setOpen] = React.useState(false);
  const [sub, setSub] = React.useState<SubMenu>(null);
  const [busy, setBusy] = React.useState(false);

  // Track the block rect on scroll/resize (same approach as the inline toolbar).
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (!dom) return;
    const onChange = (): void => force();
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    return () => {
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
    };
  }, [dom]);

  // Close the menu whenever the selection changes.
  React.useEffect(() => {
    setOpen(false);
    setSub(null);
  }, [selectedId]);

  // Close on Escape (clicks inside stopPropagation; outside clicks change the
  // selection, which closes via the effect above).
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        setOpen(false);
        setSub(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isText = supportsTextAi(displayName);
  const isImage = displayName === IMAGE_BLOCK;

  if (!selectedId || !dom || (!isText && !isImage)) return null;

  const rect = dom.getBoundingClientRect();
  const top = Math.max(rect.top - 30, 4);
  const left = Math.max(rect.left + 4, 4);

  const setProp = (key: string, value: string): void => {
    actions.setProp(selectedId, (p: Record<string, unknown>) => {
      p[key] = value;
    });
  };

  const runText = async (op: TextOp, opts?: { tone?: Tone; targetLang?: string }): Promise<void> => {
    const target = resolveTextTarget(displayName, props);
    if (!target || !target.value.trim()) {
      toast.error("This block has no text to transform yet.");
      return;
    }
    setBusy(true);
    try {
      const { text } = await aiTextOp({ op, text: target.value, ...opts });
      setProp(target.key, text);
      toast.success("Updated with AI");
      setOpen(false);
      setSub(null);
    } catch (e) {
      toast.error(aiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const runAltText = async (): Promise<void> => {
    const url = props[IMAGE_URL_PROP];
    if (typeof url !== "string" || !url.trim()) {
      toast.error("Set an image URL first, then generate alt text.");
      return;
    }
    setBusy(true);
    try {
      const { altText } = await aiAltText(url);
      setProp(IMAGE_ALT_PROP, altText);
      toast.success("Alt text generated");
      setOpen(false);
    } catch (e) {
      toast.error(aiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const stop = (e: React.SyntheticEvent): void => e.stopPropagation();

  return (
    <div
      className="fixed z-50 flex flex-col items-start"
      style={{ top, left }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={stop}
    >
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setSub(null);
        }}
        className="flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-semibold text-primary shadow-md transition-colors hover:bg-accent"
        title="AI assist"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        AI
      </button>

      {open && (
        <div
          className="mt-1 min-w-[11rem] overflow-visible rounded-md border border-border bg-card p-1 text-card-foreground shadow-md"
          role="menu"
        >
          {isText && sub === null && (
            <>
              <MenuItem disabled={busy} onClick={() => void runText("rewrite")}>
                Rewrite
              </MenuItem>
              <MenuItem disabled={busy} onClick={() => void runText("shorten")}>
                Shorten
              </MenuItem>
              <MenuItem disabled={busy} onClick={() => void runText("expand")}>
                Expand
              </MenuItem>
              <MenuItem disabled={busy} onClick={() => void runText("fix-grammar")}>
                Fix grammar
              </MenuItem>
              <div className="my-1 h-px bg-border" />
              <MenuItem disabled={busy} hasSub onClick={() => setSub("tone")}>
                Change tone
              </MenuItem>
              <MenuItem disabled={busy} hasSub onClick={() => setSub("translate")}>
                Translate
              </MenuItem>
            </>
          )}

          {isText && sub === "tone" && (
            <>
              <BackItem onClick={() => setSub(null)} label="Change tone" />
              {TONES.map((t) => (
                <MenuItem
                  key={t.value}
                  disabled={busy}
                  onClick={() => void runText("change-tone", { tone: t.value })}
                >
                  {t.label}
                </MenuItem>
              ))}
            </>
          )}

          {isText && sub === "translate" && (
            <>
              <BackItem onClick={() => setSub(null)} label="Translate to" />
              {LANGUAGES.map((lang) => (
                <MenuItem
                  key={lang}
                  disabled={busy}
                  onClick={() => void runText("translate", { targetLang: lang })}
                >
                  {lang}
                </MenuItem>
              ))}
            </>
          )}

          {isImage && (
            <MenuItem disabled={busy} onClick={() => void runAltText()}>
              Generate alt text
            </MenuItem>
          )}
        </div>
      )}
    </div>
  );
};

const MenuItem: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  hasSub?: boolean;
  children: React.ReactNode;
}> = ({ onClick, disabled, hasSub, children }) => (
  <button
    type="button"
    role="menuitem"
    disabled={disabled}
    onClick={onClick}
    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
  >
    <span>{children}</span>
    {hasSub && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
  </button>
);

const BackItem: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className="mb-1 flex w-full items-center gap-1 rounded px-2 py-1 text-left text-[10px] font-semibold uppercase text-muted-foreground transition-colors hover:bg-accent"
  >
    <ChevronRight className="h-3 w-3 rotate-180" />
    {label}
  </button>
);
