import { useEffect } from "react";
import { RouterProvider } from "react-router/dom";
import { AppProviders } from "@/providers/AppProviders";
import { router } from "@/routes/router";
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MediaPickerProvider } from "@/views/media/components/MediaPickerProvider";
import { useAppSelector } from "@/store/store";
import "@/store/siteStore"; // registers the X-Site-Id resolver with the Axios mutator

/** Applies the Redux theme mode to the <html> element (drives the `.dark` CSS). */
const ThemeSync = () => {
  const mode = useAppSelector((s) => s.theme.mode);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", mode === "dark");
  }, [mode]);
  return null;
};

export const App = () => (
  <AppProviders>
    <ThemeSync />
    <TooltipProvider delayDuration={300}>
      <ConfirmProvider>
        <MediaPickerProvider>
          <RouterProvider router={router} />
        </MediaPickerProvider>
      </ConfirmProvider>
      <Toaster />
    </TooltipProvider>
  </AppProviders>
);
