import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui";
import { Button, Label } from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import { useTheme, useUpdateTheme } from "@/views/theme/hooks/useTheme";

/** One-click site theme presets (token bundles). */
const THEME_PRESETS: Record<
  string,
  { label: string; tokens: Record<string, string | number> }
> = {
  corporate: {
    label: "Corporate",
    tokens: {
      primary: "#1e40af",
      secondary: "#64748b",
      background: "#ffffff",
      foreground: "#0f172a",
      accent: "#3b82f6",
      muted: "#f1f5f9",
      radius: 6,
    },
  },
  startup: {
    label: "Startup",
    tokens: {
      primary: "#7c3aed",
      secondary: "#a78bfa",
      background: "#fafafa",
      foreground: "#18181b",
      accent: "#f472b6",
      muted: "#f4f4f5",
      radius: 12,
    },
  },
  dark: {
    label: "Dark",
    tokens: {
      primary: "#38bdf8",
      secondary: "#94a3b8",
      background: "#0f172a",
      foreground: "#f8fafc",
      accent: "#22d3ee",
      muted: "#1e293b",
      radius: 8,
    },
  },
  minimal: {
    label: "Minimal",
    tokens: {
      primary: "#171717",
      secondary: "#737373",
      background: "#ffffff",
      foreground: "#171717",
      accent: "#525252",
      muted: "#f5f5f5",
      radius: 4,
    },
  },
  creative: {
    label: "Creative",
    tokens: {
      primary: "#ea580c",
      secondary: "#fbbf24",
      background: "#fffbeb",
      foreground: "#431407",
      accent: "#dc2626",
      muted: "#fef3c7",
      radius: 16,
    },
  },
};

interface GlobalStylesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Global design system quick editor — theme presets + link to full theme editor.
 */
export const GlobalStylesDialog: React.FC<GlobalStylesDialogProps> = ({ open, onOpenChange }) => {
  const { data: theme } = useTheme();
  const updateTheme = useUpdateTheme();
  const tokens = (theme?.tokens ?? {}) as Record<string, unknown>;

  const applyPreset = async (key: string): Promise<void> => {
    const preset = THEME_PRESETS[key];
    if (!preset) return;
    try {
      await updateTheme.mutateAsync({
        tokens: { ...tokens, ...preset.tokens },
      });
      toast.success(`Applied ${preset.label} theme`);
    } catch {
      toast.error("Could not update theme");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Global styles</DialogTitle>
          <DialogDescription>
            Site-wide colors, spacing, and typography tokens. Changes apply to every page using
            theme values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
              Theme presets
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(THEME_PRESETS).map(([key, p]) => (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => void applyPreset(key)}
                  disabled={updateTheme.isPending}
                >
                  <span
                    className="mr-2 inline-block h-3 w-3 rounded-full border"
                    style={{ background: String(p.tokens.primary) }}
                  />
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Buttons, cards, and links that use theme colors (Primary, Muted, etc.) update
            automatically when you switch presets.
          </p>

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              window.open("/theme", "_blank", "noopener");
            }}
          >
            Open full theme editor
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
