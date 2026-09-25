import * as React from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import { useUploadMedia } from "../hooks/useMedia";
import type { MediaItem } from "../types";

/** Hidden-input upload button. Uploads files sequentially via the presign flow. */
export const UploadButton: React.FC<{
  onUploaded?: (item: MediaItem) => void;
  accept?: string;
  label?: string;
  /** Icon-only compact button (no text label). */
  iconOnly?: boolean;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}> = ({ onUploaded, accept, label = "Upload", iconOnly, variant, size, className }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const upload = useUploadMedia();

  const onFiles = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        const item = await upload.mutateAsync(file);
        onUploaded?.(item);
      } catch {
        toast.error(`Upload failed: ${file.name}`);
      }
    }
    toast.success("Upload complete");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => void onFiles(e.target.files)}
      />
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
        title={label}
      >
        {upload.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : iconOnly ? (
          <Upload className="h-4 w-4" />
        ) : (
          <>
            <Upload className="mr-1.5 h-4 w-4" />
            {label}
          </>
        )}
      </Button>
    </>
  );
};
