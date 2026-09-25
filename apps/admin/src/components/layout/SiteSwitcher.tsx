import * as React from "react";
import { ChevronsUpDown, Check, Globe, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import { useActiveSite } from "@/views/sites/hooks/useSites";
import { CreateSiteWizard } from "@/views/sites/components/CreateSiteWizard";

/**
 * Site switcher: selects the active tenant/site (drives the X-Site-Id header)
 * and exposes a "New website" action that opens the create wizard. Designed to
 * sit in the topbar so the active website is always visible.
 */
export const SiteSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { sites, activeSite, activeSiteId, setActiveSiteId, isLoading } = useActiveSite();
  const [wizardOpen, setWizardOpen] = React.useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 rounded-md border border-border bg-background text-left text-sm transition-colors hover:bg-accent",
              compact ? "px-2.5 py-1.5" : "w-full px-3 py-2",
            )}
          >
            <Globe className="h-4 w-4 shrink-0 text-primary" />
            <span
              className={cn(
                "min-w-0 truncate font-medium",
                compact ? "max-w-[7rem] sm:max-w-[10rem] md:max-w-[14rem]" : "flex-1",
              )}
            >
              {isLoading ? "Loading…" : (activeSite?.name ?? "Select a website")}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={compact ? "end" : "start"} className="w-60">
          <DropdownMenuLabel>Websites</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {sites.length === 0 && (
            <DropdownMenuItem disabled>No websites yet</DropdownMenuItem>
          )}
          {sites.map((site) => (
            <DropdownMenuItem key={site.id} onClick={() => setActiveSiteId(site.id)}>
              <Check
                className={cn(
                  "h-4 w-4",
                  activeSiteId === site.id ? "opacity-100" : "opacity-0",
                )}
              />
              <span className="truncate">{site.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4" /> New website
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateSiteWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </>
  );
};
