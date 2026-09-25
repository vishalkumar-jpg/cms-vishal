import { Toaster as SonnerToaster, toast } from "sonner";
import { useAppSelector } from "@/store/store";

/** App-wide toast host. Theme follows the Redux theme slice. */
export const Toaster = () => {
  const mode = useAppSelector((s) => s.theme.mode);
  return (
    <SonnerToaster
      theme={mode}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "rounded-lg border border-border bg-card text-card-foreground shadow-lg",
        },
      }}
    />
  );
};

export { toast };
