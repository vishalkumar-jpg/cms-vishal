import * as React from "react";
import { useNavigate, useParams } from "react-router";
import { Editor } from "@craftjs/core";
import { Loader2 } from "lucide-react";
import { useSiteStore } from "@/store/siteStore";
import { resolver } from "@/views/builder/craft/resolver";
import { layoutToCraft } from "@/views/builder/craft/serialize";
import { GlobalsBuilderShell } from "./components/GlobalsBuilderShell";
import { useSiteChrome } from "./hooks/useSiteChrome";
import type { ChromeSlot } from "./api/globals.api";

const isSlot = (v: string | undefined): v is ChromeSlot => v === "header" || v === "footer";

/**
 * GLOBAL-CHROME builder route (`/globals/:slot`). Loads the site's chrome,
 * deserializes the chosen slot's SerializedLayout into Craft node JSON, and
 * mounts the SAME <Editor> + resolver as the page builder so authored chrome
 * renders with the real shared blocks (editor↔renderer parity).
 *
 * Switching slots navigates to the sibling route; the <Editor> is `key`ed on the
 * slot so Craft re-hydrates from the other slot's saved layout on switch.
 */
export const GlobalsBuilder: React.FC = () => {
  const { slot: slotParam } = useParams();
  const navigate = useNavigate();
  const slot: ChromeSlot = isSlot(slotParam) ? slotParam : "header";
  const siteId = useSiteStore((s) => s.activeSiteId);
  const { data: chrome, isLoading, isError } = useSiteChrome(siteId);

  const layout = slot === "header" ? chrome?.header : chrome?.footer;

  // Deserialize the slot's layout -> Craft <Frame data> JSON (node map string).
  const initialJson = React.useMemo<string | null>(() => {
    if (!layout) return null;
    try {
      return JSON.stringify(layoutToCraft(layout));
    } catch {
      return null;
    }
  }, [layout]);

  const onSwitchSlot = (next: ChromeSlot): void => {
    if (next !== slot) navigate(`/globals/${next}`);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Could not load global header/footer. The site-chrome API may be unavailable.
      </div>
    );
  }

  return (
    <Editor
      key={slot}
      resolver={resolver}
      indicator={{ success: "hsl(var(--primary))", error: "#ef4444" }}
    >
      <GlobalsBuilderShell
        siteId={siteId}
        slot={slot}
        initialJson={initialJson}
        onSwitchSlot={onSwitchSlot}
      />
    </Editor>
  );
};
