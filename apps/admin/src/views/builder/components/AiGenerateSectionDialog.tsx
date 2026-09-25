import * as React from "react";
import { useEditor } from "@craftjs/core";
import { Sparkles, Loader2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import { layoutToCraft } from "../craft/serialize";
import { buildTreeFromSerializedMap, cloneNodeTree } from "../craft/nodeOps";
import { aiErrorMessage, aiSection } from "../ai/aiApi";

/**
 * "✨ Generate section" flow. A marketer types a prompt, the SYNC `/ai/section`
 * endpoint returns a validated Section subtree (root "ROOT"), and we insert each
 * top-level child under the canvas ROOT — exactly like the Section Library
 * (`layoutToCraft` → `buildTreeFromSerializedMap` → `addNodeTree`), which mints
 * FRESH node ids on insert, so the inserted section is fully editable and never
 * collides. Inserts after the current selection's top-level ancestor when there
 * is one, else appends.
 *
 * Mounted inside <Editor>; controlled by the parent shell. Works offline with
 * AI_MOCK=true; a missing AI key surfaces a clear toast.
 */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AiGenerateSectionDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { actions, query } = useEditor();
  const [prompt, setPrompt] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setPrompt("");
  }, [open]);

  const insertLayout = React.useCallback(
    (layout: Parameters<typeof layoutToCraft>[0]): void => {
      const map = layoutToCraft(layout);
      const childIds = map["ROOT"]?.nodes ?? [];

      // Insert directly after the selected block's top-level ancestor.
      let index: number | undefined;
      try {
        const selected = query.getEvent("selected").all();
        const selId = selected[selected.length - 1];
        if (selId && selId !== "ROOT") {
          let cur = selId;
          let parent = query.node(cur).get().data.parent;
          while (parent && parent !== "ROOT") {
            cur = parent;
            parent = query.node(cur).get().data.parent;
          }
          if (parent === "ROOT") {
            const siblings = query.node("ROOT").get().data.nodes;
            const at = siblings.indexOf(cur);
            if (at >= 0) index = at + 1;
          }
        }
      } catch {
        /* fall back to append */
      }

      let inserted = 0;
      for (const childId of childIds) {
        try {
          const tree = buildTreeFromSerializedMap(query, map, childId);
          // Fresh ids so repeated generations/inserts can't collide.
          actions.addNodeTree(cloneNodeTree(query, tree), "ROOT", index);
          if (index != null) index += 1;
          inserted += 1;
        } catch {
          /* skip invalid child */
        }
      }
      if (inserted === 0) throw new Error("The generated section was empty.");
    },
    [actions, query],
  );

  const generate = async (): Promise<void> => {
    const p = prompt.trim();
    if (p.length < 3) {
      toast.error("Describe the section you want (a few words is enough).");
      return;
    }
    setBusy(true);
    try {
      const { layout } = await aiSection(p);
      insertLayout(layout);
      toast.success("Section generated");
      onOpenChange(false);
    } catch (e) {
      toast.error(aiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!busy ? onOpenChange(o) : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Generate a section with AI
          </DialogTitle>
          <DialogDescription>
            Describe the section you want. It will be inserted as editable blocks at
            your current spot on the page.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          rows={4}
          value={prompt}
          disabled={busy}
          placeholder="e.g. A pricing section with three tiers and a highlighted middle plan"
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void generate();
          }}
        />
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void generate()} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
