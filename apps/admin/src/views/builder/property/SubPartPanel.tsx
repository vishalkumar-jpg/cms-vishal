import * as React from "react";
import { useEditor } from "@craftjs/core";
import { ChevronLeft, Type as TypeIcon, ImageIcon, MousePointerClick, ImagePlus } from "lucide-react";
import { Label, Input, Button } from "@/components/ui";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditorUiStore, type SelectedSubPart } from "../store/editorUiStore";
import { useUpdateProp } from "./useUpdateProp";
import { StyleControls } from "./StyleControls";
import { LayoutControls } from "./LayoutControls";
import { useAssetPickStore } from "../store/assetPickStore";
import type { Breakpoint } from "./styleTokens";
import { styleBreakpointKey } from "../store/editorUiStore";
const getNested = (obj: Record<string, unknown>, path: string): unknown => {
  let cursor: unknown = obj;
  for (const key of path.split(".")) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
};

const asDict = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

const kindIcon = (part: SelectedSubPart): React.ReactNode => {
  if (part.imagePath) return <ImageIcon className="h-3.5 w-3.5" />;
  if (part.key === "button") return <MousePointerClick className="h-3.5 w-3.5" />;
  return <TypeIcon className="h-3.5 w-3.5" />;
};

/**
 * Contextual editor for a selected sub-part of a block (e.g. a Hero card's
 * title / image / button). Shows text editing (when the part has a text prop),
 * an image URL field (image parts), and the FULL style controls scoped to the
 * part's own StyleModel bag via `StyleControls rootPath`. Edits flow through the
 * same `setProp` path as everything else (autosave + undo/redo).
 */
export const SubPartPanel: React.FC<{ part: SelectedSubPart; breakpoint: Breakpoint }> = ({
  part,
  breakpoint,
}) => {
  const styleBp = styleBreakpointKey(breakpoint);
  const clearSubPart = useEditorUiStore((s) => s.clearSubPart);
  const openAssetPick = useAssetPickStore((s) => s.open);
  const update = useUpdateProp(part.nodeId);

  const props = useEditor((state) => {
    const node = state.nodes[part.nodeId];
    return (node?.data.props ?? {}) as Record<string, unknown>;
  });

  const textValue = part.textPath ? String(getNested(props, part.textPath) ?? "") : "";
  const imageValue = part.imagePath ? String(getNested(props, part.imagePath) ?? "") : "";
  const partStyles = part.stylePath ? asDict(getNested(props, part.stylePath)) : {};

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={clearSubPart}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Back to block
      </button>

      <div className="flex items-center gap-2 rounded-md border border-border bg-accent/40 px-3 py-2">
        {kindIcon(part)}
        <span className="text-sm font-semibold">{part.label}</span>
        <span className="ml-auto text-[10px] uppercase text-muted-foreground">part</span>
      </div>

      {part.textPath && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Text</Label>
          <Textarea
            value={textValue}
            rows={3}
            onChange={(e) => update(part.textPath as string, e.target.value)}
            placeholder={`Edit ${part.label.toLowerCase()} text…`}
          />
        </div>
      )}

      {part.imagePath && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Image</Label>
          <div className="flex gap-1">
            <Input
              value={imageValue}
              onChange={(e) => update(part.imagePath as string, e.target.value)}
              placeholder="https://…"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              title="Browse assets"
              onClick={() => {
                void openAssetPick("image").then((item) => {
                  if (item?.url) update(part.imagePath as string, item.url);
                });
              }}
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
          </div>
          {imageValue ? (
            <img
              src={imageValue}
              alt=""
              className="mt-1 h-24 w-full rounded-md border border-border object-cover"
            />
          ) : null}
        </div>
      )}

      {part.stylePath && (
        <div className="border-t border-border pt-3">
          <Tabs defaultValue="layout" className="flex flex-col gap-3">
            <TabsList className="w-full">
              <TabsTrigger value="layout" className="flex-1 text-xs">
                Layout
              </TabsTrigger>
              <TabsTrigger value="style" className="flex-1 text-xs">
                Visual
              </TabsTrigger>
            </TabsList>
            <TabsContent value="layout" className="mt-0">
              <LayoutControls
                nodeId={part.nodeId}
                styles={partStyles}
                breakpoint={styleBp}
                rootPath={part.stylePath}
              />
            </TabsContent>
            <TabsContent value="style" className="mt-0">
              <StyleControls
                nodeId={part.nodeId}
                styles={partStyles}
                breakpoint={styleBp}
                rootPath={part.stylePath}
                sections="visual"
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};
