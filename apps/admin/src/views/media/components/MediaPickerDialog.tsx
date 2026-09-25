import * as React from "react";
import { Search } from "lucide-react";
import { Button, Input } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMediaList } from "../hooks/useMedia";
import { MediaGrid } from "./MediaGrid";
import { StockSearch } from "./StockSearch";
import { UploadButton } from "./UploadButton";
import type { MediaItem } from "../types";

/** Modal media browser used by image controls across the app. */
export const MediaPickerDialog: React.FC<{
  open: boolean;
  onSelect: (item: MediaItem) => void;
  onCancel: () => void;
}> = ({ open, onSelect, onCancel }) => {
  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState<MediaItem | null>(null);
  const { data: items = [], isLoading } = useMediaList(q ? { q } : undefined);

  React.useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Select media</DialogTitle>
          <DialogDescription>Choose an existing asset or upload a new one.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="library">
          <TabsList>
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="stock">Stock</TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="mt-3 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by alt text…"
                  className="pl-9"
                />
              </div>
              <UploadButton accept="image/*,video/*" onUploaded={(item) => setSelected(item)} />
            </div>

            <div className="max-h-[50vh] min-h-[16rem] overflow-y-auto">
              <MediaGrid
                items={items}
                isLoading={isLoading}
                selectedId={selected?.id}
                onItemClick={setSelected}
              />
            </div>
          </TabsContent>

          <TabsContent value="stock" className="mt-3">
            <StockSearch selectedId={selected?.id} onItemClick={setSelected} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={!selected} onClick={() => selected && onSelect(selected)}>
            Use selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
