import * as React from "react";
import { Search, Keyboard, BookOpen, Sparkles, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useEditorUiStore } from "../store/editorUiStore";
import { restartOnboarding } from "../onboarding/OnboardingTour";

const SHORTCUTS = [
  { keys: "⌘/Ctrl + Z", action: "Undo" },
  { keys: "⌘/Ctrl + Shift + Z", action: "Redo" },
  { keys: "⌘/Ctrl + S", action: "Save draft" },
  { keys: "⌘/Ctrl + K", action: "Command palette" },
  { keys: "⌘/Ctrl + F", action: "Find & replace" },
  { keys: "Delete", action: "Delete selected block" },
  { keys: "Shift + Click", action: "Multi-select blocks" },
];

const FAQ = [
  {
    q: "How do I add a block?",
    a: "Open the Blocks tab on the left, then drag a block onto the canvas or click to insert.",
  },
  {
    q: "How do I edit text?",
    a: "Select a heading or paragraph and type directly on the canvas, or use Content mode.",
  },
  {
    q: "How do I style a button?",
    a: "Select the button, open the Style tab on the right, and adjust colors, spacing, and borders.",
  },
  {
    q: "How do I preview on mobile?",
    a: "Use the device icons in the toolbar to switch to Tablet or Mobile preview widths.",
  },
];

interface HelpCenterPanelProps {
  onClose: () => void;
}

export const HelpCenterPanel: React.FC<HelpCenterPanelProps> = ({ onClose }) => {
  const [q, setQ] = React.useState("");
  const setHelpMode = useEditorUiStore((s) => s.setHelpMode);

  const filteredFaq = FAQ.filter(
    (f) => !q || f.q.toLowerCase().includes(q.toLowerCase()) || f.a.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="h-4 w-4" />
          Help center
        </h2>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close help">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-xs">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search help…"
            className="h-8 pl-7 text-xs"
            aria-label="Search help"
          />
        </div>

        <section className="mb-5">
          <h3 className="mb-2 flex items-center gap-1.5 font-semibold">
            <Sparkles className="h-3.5 w-3.5" /> Quick actions
          </h3>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setHelpMode(true);
                onClose();
              }}
            >
              Turn on Help mode
            </Button>
            <Button size="sm" variant="outline" onClick={() => restartOnboarding()}>
              Restart guided tour
            </Button>
          </div>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 flex items-center gap-1.5 font-semibold">
            <Keyboard className="h-3.5 w-3.5" /> Keyboard shortcuts
          </h3>
          <ul className="space-y-1.5">
            {SHORTCUTS.map((s) => (
              <li key={s.keys} className="flex justify-between rounded-md border border-border px-2 py-1.5">
                <span className="font-mono text-[10px]">{s.keys}</span>
                <span className="text-muted-foreground">{s.action}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 font-semibold">FAQ</h3>
          <ul className="space-y-2">
            {filteredFaq.map((f) => (
              <li key={f.q} className="rounded-md bg-muted/40 px-2.5 py-2">
                <p className="font-medium">{f.q}</p>
                <p className="mt-1 text-muted-foreground">{f.a}</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 font-semibold">What's new</h3>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            <li>Pixel rulers and canvas-scoped grid overlay</li>
            <li>Landscape device preview for tablet and mobile</li>
            <li>Asset folders, bulk actions, and details panel</li>
            <li>Layer folders with drag-to-organize</li>
            <li>Session recovery and expanded diagnostics</li>
          </ul>
        </section>
      </div>
    </div>
  );
};
