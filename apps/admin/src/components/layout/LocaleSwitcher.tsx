import * as React from "react";
import { Languages, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { setLocale } from "@/store/slices/localeSlice";
import { useLocales } from "@/views/settings/hooks/useSettings";

/**
 * i18n (B13) topbar locale switcher. Reflects the active site's locale set
 * (`/sites/:id/locales`) and drives the UI-only Redux `locale` state, which the
 * Pages/Blog screens read to filter the list to that locale + offer
 * "Add translation". Hidden for single-locale sites so nothing changes there.
 *
 * Keeps the active locale valid: when the site (or its locale set) changes it
 * snaps back to the default locale if the current selection is no longer offered.
 */
export const LocaleSwitcher: React.FC = () => {
  const { data } = useLocales();
  const dispatch = useAppDispatch();
  const active = useAppSelector((s) => s.locale.locale);

  const locales = data?.locales ?? [];
  const defaultLocale = data?.defaultLocale ?? "en";

  // Snap to a valid locale whenever the offered set changes.
  React.useEffect(() => {
    if (locales.length === 0) return;
    if (!locales.includes(active)) dispatch(setLocale(defaultLocale));
  }, [locales, active, defaultLocale, dispatch]);

  // Single-locale sites: nothing to switch — render nothing.
  if (locales.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Active content locale"
          className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Languages className="h-3.5 w-3.5" />
          <span className="uppercase">{active}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Content locale</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {locales.map((l) => (
          <DropdownMenuItem key={l} onClick={() => dispatch(setLocale(l))}>
            <Check className={cn("h-4 w-4", active === l ? "opacity-100" : "opacity-0")} />
            <span className="uppercase">{l}</span>
            {l === defaultLocale ? (
              <span className="ml-auto text-[10px] text-muted-foreground">default</span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
