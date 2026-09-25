import * as React from "react";
import { useSearchParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  parseTemplateLibraryTab,
  type TemplateLibraryTab,
} from "../lib/templateLibraryTab";
import {
  MY_TEMPLATES_TAB_LABEL,
  STARTER_TEMPLATES_TAB_LABEL,
} from "../constants";

export { parseTemplateLibraryTab } from "../lib/templateLibraryTab";
export type { TemplateLibraryTab } from "../lib/templateLibraryTab";

const TAB_PARAM = "tab";

export type TemplateLibraryTabsProps = {
  starterContent: React.ReactNode;
  mineContent: React.ReactNode;
};

/** URL-synced tabs — `/template-library?tab=starter|mine`. */
export const TemplateLibraryTabs: React.FC<TemplateLibraryTabsProps> = ({
  starterContent,
  mineContent,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTemplateLibraryTab(searchParams.get(TAB_PARAM));

  const setTab = (next: TemplateLibraryTab): void => {
    const params = new URLSearchParams(searchParams);
    if (next === "starter") {
      params.delete(TAB_PARAM);
    } else {
      params.set(TAB_PARAM, next);
    }
    setSearchParams(params, { replace: true });
  };

  return (
    <Tabs value={activeTab} onValueChange={(value) => setTab(parseTemplateLibraryTab(value))}>
      <TabsList className="mb-6" aria-label="Template library sections">
        <TabsTrigger value="starter">{STARTER_TEMPLATES_TAB_LABEL}</TabsTrigger>
        <TabsTrigger value="mine">{MY_TEMPLATES_TAB_LABEL}</TabsTrigger>
      </TabsList>
      <TabsContent value="starter">{starterContent}</TabsContent>
      <TabsContent value="mine">{mineContent}</TabsContent>
    </Tabs>
  );
};
