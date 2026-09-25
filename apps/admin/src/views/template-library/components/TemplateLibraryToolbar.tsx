import * as React from "react";
import { ChevronDown, Search } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_LABEL } from "@/views/template-catalog/lib/catalogLabels";
import {
  TEMPLATE_CATALOG_CATEGORIES,
  type TemplateCatalogCategory,
} from "@/views/template-catalog/types";
import { STARTER_FILTER_ALL_LABEL } from "@/views/template-catalog/lib/catalogLabels";
import type { MineKindFilter } from "../lib/filterLibraryItems";
import {
  MINE_SORT_OPTIONS,
  STARTER_SORT_OPTIONS,
  type MineSortId,
  type StarterSortId,
} from "../lib/sortLibraryItems";
import {
  CLEAR_FILTERS_LABEL,
  TEMPLATE_KIND_FILTER_ALL_LABEL,
  TEMPLATE_KIND_LABELS,
  TEMPLATE_LIBRARY_ACTIVE_FILTERS_LABEL,
  TEMPLATE_LIBRARY_FEATURED_FILTER_LABEL,
  TEMPLATE_LIBRARY_FILTERS_LABEL,
  TEMPLATE_LIBRARY_MINE_SEARCH_PLACEHOLDER,
  TEMPLATE_LIBRARY_OF_COUNT_LABEL,
  TEMPLATE_LIBRARY_SHOWING_COUNT_LABEL,
  TEMPLATE_LIBRARY_SORT_LABEL,
  TEMPLATE_LIBRARY_STARTER_FILTER_ALL_LABEL,
  TEMPLATE_LIBRARY_STARTER_SEARCH_PLACEHOLDER,
  TEMPLATE_LIBRARY_TEMPLATES_NOUN,
} from "../constants";
import { TemplateLibraryFilterChip } from "./TemplateLibraryFilterChip";

type ToolbarCountProps = {
  showing: number;
  total: number;
  filterSummary?: string | null;
  filtersActive?: boolean;
  onClearFilters?: () => void;
};

const ToolbarSummary: React.FC<ToolbarCountProps> = ({
  showing,
  total,
  filterSummary,
  filtersActive,
  onClearFilters,
}) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-xs text-muted-foreground" role="status">
      {TEMPLATE_LIBRARY_SHOWING_COUNT_LABEL}{" "}
      <span className="font-medium text-foreground">{showing}</span>{" "}
      {TEMPLATE_LIBRARY_OF_COUNT_LABEL}{" "}
      <span className="font-medium text-foreground">{total}</span>{" "}
      {TEMPLATE_LIBRARY_TEMPLATES_NOUN}
    </p>
    {filterSummary ? (
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{TEMPLATE_LIBRARY_ACTIVE_FILTERS_LABEL}:</span>{" "}
        {filterSummary}
      </p>
    ) : null}
    {filtersActive && onClearFilters ? (
      <Button type="button" variant="ghost" size="sm" className="h-8 self-start sm:self-auto" onClick={onClearFilters}>
        {CLEAR_FILTERS_LABEL}
      </Button>
    ) : null}
  </div>
);

export type StarterToolbarProps = {
  variant: "starter";
  search: string;
  onSearchChange: (value: string) => void;
  category: TemplateCatalogCategory | "all";
  onCategoryChange: (value: TemplateCatalogCategory | "all") => void;
  featuredOnly: boolean;
  onFeaturedOnlyChange: (value: boolean) => void;
  sort: StarterSortId;
  onSortChange: (value: StarterSortId) => void;
  showing: number;
  total: number;
  filterSummary?: string | null;
  filtersActive?: boolean;
  onClearFilters?: () => void;
};

export type MineToolbarProps = {
  variant: "mine";
  search: string;
  onSearchChange: (value: string) => void;
  kind: MineKindFilter;
  onKindChange: (value: MineKindFilter) => void;
  sort: MineSortId;
  onSortChange: (value: MineSortId) => void;
  showing: number;
  total: number;
  filterSummary?: string | null;
  filtersActive?: boolean;
  onClearFilters?: () => void;
};

export type TemplateLibraryToolbarProps = StarterToolbarProps | MineToolbarProps;

/** Shared search, filter chips, sort, and result summary for Template Library tabs. */
export const TemplateLibraryToolbar: React.FC<TemplateLibraryToolbarProps> = (props) => {
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const searchPlaceholder =
    props.variant === "starter"
      ? TEMPLATE_LIBRARY_STARTER_SEARCH_PLACEHOLDER
      : TEMPLATE_LIBRARY_MINE_SEARCH_PLACEHOLDER;

  const filterBlock =
    props.variant === "starter" ? (
      <>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          <TemplateLibraryFilterChip
            label={STARTER_FILTER_ALL_LABEL}
            active={props.category === "all"}
            onClick={() => props.onCategoryChange("all")}
          />
          {TEMPLATE_CATALOG_CATEGORIES.map((cat) => (
            <TemplateLibraryFilterChip
              key={cat}
              label={CATEGORY_LABEL[cat]}
              active={props.category === cat}
              onClick={() => props.onCategoryChange(cat)}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Featured filter">
          <TemplateLibraryFilterChip
            label={TEMPLATE_LIBRARY_STARTER_FILTER_ALL_LABEL}
            active={!props.featuredOnly}
            onClick={() => props.onFeaturedOnlyChange(false)}
          />
          <TemplateLibraryFilterChip
            label={TEMPLATE_LIBRARY_FEATURED_FILTER_LABEL}
            active={props.featuredOnly}
            onClick={() => props.onFeaturedOnlyChange(true)}
          />
        </div>
      </>
    ) : (
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by template type">
        <TemplateLibraryFilterChip
          label={TEMPLATE_KIND_FILTER_ALL_LABEL}
          active={props.kind === "all"}
          onClick={() => props.onKindChange("all")}
        />
        <TemplateLibraryFilterChip
          label={TEMPLATE_KIND_LABELS.page}
          active={props.kind === "page"}
          onClick={() => props.onKindChange("page")}
        />
        <TemplateLibraryFilterChip
          label={TEMPLATE_KIND_LABELS.section}
          active={props.kind === "section"}
          onClick={() => props.onKindChange("section")}
        />
      </div>
    );

  return (
    <div className="mb-6 flex flex-col gap-3">
      <ToolbarSummary
        showing={props.showing}
        total={props.total}
        filterSummary={props.filterSummary}
        filtersActive={props.filtersActive}
        onClearFilters={props.onClearFilters}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={props.search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
            aria-label={searchPlaceholder}
            type="search"
          />
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-48">
          <Label htmlFor="template-library-sort" className="text-xs text-muted-foreground">
            {TEMPLATE_LIBRARY_SORT_LABEL}
          </Label>
          {props.variant === "starter" ? (
            <Select value={props.sort} onValueChange={(v) => props.onSortChange(v as StarterSortId)}>
              <SelectTrigger id="template-library-sort" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STARTER_SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={props.sort} onValueChange={(v) => props.onSortChange(v as MineSortId)}>
              <SelectTrigger id="template-library-sort" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINE_SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      <div className="md:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-between"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          {TEMPLATE_LIBRARY_FILTERS_LABEL}
          <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
        </Button>
        {filtersOpen ? <div className="mt-3 flex flex-col gap-3">{filterBlock}</div> : null}
      </div>
      <div className="hidden flex-col gap-3 md:flex">{filterBlock}</div>
    </div>
  );
};
