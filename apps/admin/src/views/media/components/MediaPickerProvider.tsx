import * as React from "react";
import { MediaPickerDialog } from "./MediaPickerDialog";
import type { MediaItem } from "../types";

/**
 * App-wide media picker. Any control (builder image inputs, blog cover, theme
 * logo, SEO og:image) calls `openMediaPicker()` to get a Promise that resolves
 * with the chosen MediaItem (or null if cancelled). Keeps a single dialog at the
 * root so it works even inside the full-screen builder.
 */
interface MediaPickerContextValue {
  open: () => Promise<MediaItem | null>;
}

const MediaPickerContext = React.createContext<MediaPickerContextValue | null>(null);

export const MediaPickerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const resolverRef = React.useRef<((item: MediaItem | null) => void) | null>(null);

  const open = React.useCallback((): Promise<MediaItem | null> => {
    setIsOpen(true);
    return new Promise<MediaItem | null>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = React.useCallback((item: MediaItem | null) => {
    setIsOpen(false);
    resolverRef.current?.(item);
    resolverRef.current = null;
  }, []);

  const value = React.useMemo(() => ({ open }), [open]);

  return (
    <MediaPickerContext.Provider value={value}>
      {children}
      <MediaPickerDialog
        open={isOpen}
        onCancel={() => settle(null)}
        onSelect={(item) => settle(item)}
      />
    </MediaPickerContext.Provider>
  );
};

/** Returns an async `openMediaPicker()`; throws if used outside the provider. */
export const useMediaPicker = (): (() => Promise<MediaItem | null>) => {
  const ctx = React.useContext(MediaPickerContext);
  if (!ctx) {
    // Soft fallback: never crash a control; just resolve null.
    return async () => null;
  }
  return ctx.open;
};
