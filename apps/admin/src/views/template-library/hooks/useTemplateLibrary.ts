import * as React from "react";
import { useSiteStore } from "@/store/siteStore";
import { useTemplateCatalog } from "@/views/template-catalog/hooks/useTemplateCatalog";
import { useTemplates } from "@/views/templates/hooks/useTemplates";
import {
  mapMineToLibraryItems,
  mapStartersToLibraryItems,
} from "../lib/mapLibraryItems";

/** Compose starter catalog + site mine templates into unified library items. */
export const useTemplateLibrary = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);

  const catalog = useTemplateCatalog({ sort: "displayName" });
  const mine = useTemplates(siteId);

  const starterItems = React.useMemo(
    () => mapStartersToLibraryItems(catalog.data ?? []),
    [catalog.data],
  );

  const mineItems = React.useMemo(
    () => mapMineToLibraryItems(mine.data ?? [], siteId),
    [mine.data, siteId],
  );

  const loading = Boolean(siteId) && (catalog.isLoading || mine.isLoading);
  const error = catalog.isError || mine.isError;

  const refetch = React.useCallback(async (): Promise<void> => {
    await Promise.all([catalog.refetch(), mine.refetch()]);
  }, [catalog.refetch, mine.refetch]);

  return {
    starterItems,
    mineItems,
    loading,
    error,
    refetch,
  };
};
