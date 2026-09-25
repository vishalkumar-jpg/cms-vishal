import * as React from "react";
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  List,
  ListOrdered,
  Heading1,
  Type,
} from "lucide-react";
import { ColorPickerRow } from "../property/colorPickerRow";
import { usePrompt } from "@/components/ui/confirm-provider";

const exec = (cmd: string, val?: string): void => {
  document.execCommand(cmd, false, val);
};

/**
 * Bubble toolbar for contentEditable text — appears when the user selects text
 * inside the builder canvas (.ob-site).
 */
export const FloatingTextToolbar: React.FC = () => {
  const prompt = usePrompt();
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  React.useEffect(() => {
    const onSelectionChange = (): void => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setPos(null);
        return;
      }
      const anchor = sel.anchorNode;
      const el =
        anchor?.nodeType === Node.TEXT_NODE
          ? anchor.parentElement
          : (anchor as HTMLElement | null);
      if (!el?.closest(".ob-site") || !el.closest("[contenteditable='true']")) {
        setPos(null);
        return;
      }
      // Button / link labels — edit in the panel; double-click opens the URL instead.
      if (el.closest("a[href]")) {
        setPos(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setPos(null);
        return;
      }
      setPos({
        top: Math.max(8, rect.top - 44),
        left: Math.min(window.innerWidth - 320, Math.max(8, rect.left + rect.width / 2 - 160)),
      });
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  if (!pos) return null;

  const Btn: React.FC<{
    label: string;
    onClick: () => void;
    children: React.ReactNode;
  }> = ({ label, onClick, children }) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-foreground transition-colors hover:bg-accent"
    >
      {children}
    </button>
  );

  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="fixed z-[70] flex items-center gap-0.5 rounded-lg border border-border bg-card px-1 py-0.5 shadow-lg"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Btn label="Bold" onClick={() => exec("bold")}>
        <Bold className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Italic" onClick={() => exec("italic")}>
        <Italic className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Underline" onClick={() => exec("underline")}>
        <Underline className="h-3.5 w-3.5" />
      </Btn>
      <span className="mx-0.5 h-4 w-px bg-border" />
      <Btn label="Align left" onClick={() => exec("justifyLeft")}>
        <AlignLeft className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Align center" onClick={() => exec("justifyCenter")}>
        <AlignCenter className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Align right" onClick={() => exec("justifyRight")}>
        <AlignRight className="h-3.5 w-3.5" />
      </Btn>
      <span className="mx-0.5 h-4 w-px bg-border" />
      <Btn label="Bullet list" onClick={() => exec("insertUnorderedList")}>
        <List className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Numbered list" onClick={() => exec("insertOrderedList")}>
        <ListOrdered className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Heading" onClick={() => exec("formatBlock", "h2")}>
        <Heading1 className="h-3.5 w-3.5" />
      </Btn>
      <Btn label="Paragraph" onClick={() => exec("formatBlock", "p")}>
        <Type className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        label="Link"
        onClick={() => {
          void (async () => {
            const url = await prompt({
              title: "Link URL",
              placeholder: "https://",
              confirmLabel: "Apply",
            });
            if (url) exec("createLink", url);
          })();
        }}
      >
        <Link2 className="h-3.5 w-3.5" />
      </Btn>
      <ColorPickerRow
        compact
        className="ml-0.5"
        value="#000000"
        onChange={(v) => exec("foreColor", v)}
        ariaLabel="Text color"
        placeholder="#000000"
      />
    </div>
  );
};
