import * as React from "react";
import { ImagePlus } from "lucide-react";
import { Label, Input, Button } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssetPickStore } from "../store/assetPickStore";
import { BuilderTip } from "../components/BuilderTip";
import { RotateCcw } from "lucide-react";
import { ColorPickerRow } from "./colorPickerRow";

const BG_SIZE = ["cover", "contain", "auto", "100% 100%"];
const BG_POSITION = [
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
const BG_REPEAT = ["no-repeat", "repeat", "repeat-x", "repeat-y"];
const BG_ATTACHMENT = ["scroll", "fixed", "local"];

interface BackgroundImageFieldProps {
  colors: Record<string, unknown>;
  set: (section: string, key: string, value: unknown) => void;
  reset: (section: string, key: string) => void;
  overridden: (section: string, key: string) => boolean;
}

/** Background image controls for the Visual tab — URL, position, size, repeat, overlay. */
export const BackgroundImageField: React.FC<BackgroundImageFieldProps> = ({
  colors,
  set,
  reset,
  overridden,
}) => {
  const openPick = useAssetPickStore((s) => s.open);
  const url = String(colors["backgroundImage"] ?? "").replace(/^url\(["']?|["']?\)$/g, "");

  const pick = (): void => {
    void openPick("image").then((item) => {
      if (item?.url) set("colors", "backgroundImage", item.url);
    });
  };

  return (
    <div className="col-span-2 flex flex-col gap-2 rounded-md border border-border p-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Background image</Label>
        {overridden("colors", "backgroundImage") && (
          <button
            type="button"
            title="Reset"
            onClick={() => reset("colors", "backgroundImage")}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Add a photo or pattern behind this block. Works alongside solid colors and gradients.
      </p>
      <div className="flex gap-1.5">
        <Input
          value={url}
          onChange={(e) => set("colors", "backgroundImage", e.target.value || undefined)}
          placeholder="Image URL…"
          className="h-8 flex-1 text-xs"
        />
        <BuilderTip content="Pick from your media library">
          <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={pick}>
            <ImagePlus className="h-3.5 w-3.5" />
          </Button>
        </BuilderTip>
      </div>
      {url && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Size</Label>
              <Select
                value={String(colors["backgroundSize"] ?? "cover")}
                onValueChange={(v) => set("colors", "backgroundSize", v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BG_SIZE.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Position</Label>
              <Select
                value={String(colors["backgroundPosition"] ?? "center")}
                onValueChange={(v) => set("colors", "backgroundPosition", v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BG_POSITION.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Repeat</Label>
              <Select
                value={String(colors["backgroundRepeat"] ?? "no-repeat")}
                onValueChange={(v) => set("colors", "backgroundRepeat", v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BG_REPEAT.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Scroll with page</Label>
              <Select
                value={String(colors["backgroundAttachment"] ?? "scroll")}
                onValueChange={(v) => set("colors", "backgroundAttachment", v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BG_ATTACHMENT.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o === "fixed" ? "Fixed (parallax)" : o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-[10px] text-muted-foreground">Overlay color</Label>
              <ColorPickerRow
                compact
                value={String(colors["backgroundOverlayColor"] ?? "#000000")}
                onChange={(v) => set("colors", "backgroundOverlayColor", v)}
                ariaLabel="Background overlay color"
                placeholder="#000000"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Overlay strength</Label>
              <Input
                type="range"
                min={0}
                max={100}
                value={Math.round(numOr(colors["backgroundOverlayOpacity"], 0) * 100)}
                onChange={(e) =>
                  set(
                    "colors",
                    "backgroundOverlayOpacity",
                    Number(e.target.value) === 0 ? undefined : Number(e.target.value) / 100,
                  )
                }
                className="mt-2"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const numOr = (v: unknown, d: number): number =>
  v == null || v === "" || Number.isNaN(Number(v)) ? d : Number(v);
