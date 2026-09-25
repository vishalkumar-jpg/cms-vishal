import {
  COUNTER_SECTION_BLOCK,
  FEATURE_LIST_BLOCK,
  GALLERY_BLOCK,
  HEADING_BLOCK,
  IMAGE_BLOCK,
  LOGO_CAROUSEL_BLOCK,
  RICH_TEXT_BLOCK,
  STEP_CARDS_BLOCK,
  TABS_BLOCK,
} from "../resolved-block-names";
import { DESIGN_ROLE_MODULE_ROOT, DESIGN_ROLE_STRUCTURAL } from "../universal-design/semantic-tokens";

export type HubspotDesignApplicationTarget =
  | { kind: "root" }
  | { kind: "part"; partKey: string };

export type HubspotDesignRoleMap = Record<string, HubspotDesignApplicationTarget>;

const rootOnly = (extra?: HubspotDesignRoleMap): HubspotDesignRoleMap => ({
  [DESIGN_ROLE_MODULE_ROOT]: { kind: "root" },
  [DESIGN_ROLE_STRUCTURAL]: { kind: "root" },
  "part:visibility": { kind: "root" },
  ...extra,
});

const counterSectionRoles: HubspotDesignRoleMap = {
  ...rootOnly(),
  "part:number": { kind: "part", partKey: "value" },
  "part:title": { kind: "part", partKey: "label" },
  "part:grid": { kind: "part", partKey: "grid" },
  "part:alignment": { kind: "root" },
  "settings:typography.stat_number_font": { kind: "part", partKey: "value" },
  "settings:typography.stat_label_font": { kind: "part", partKey: "label" },
  "settings:typography.stat_description_font": { kind: "part", partKey: "description" },
  "settings:card.card_background_color": { kind: "part", partKey: "card" },
  "settings:card.card_border_color": { kind: "part", partKey: "card" },
  "settings:card.card_border_radius": { kind: "part", partKey: "card" },
  "settings:card.card_padding": { kind: "part", partKey: "card" },
  "settings:layout.column_gap": { kind: "part", partKey: "grid" },
};

const stepCardsRoles: HubspotDesignRoleMap = {
  ...rootOnly(),
  "settings:typography.step_title_font": { kind: "part", partKey: "title" },
  "settings:typography.step_description_font": { kind: "part", partKey: "description" },
  "settings:typography.body_font": { kind: "root" },
  "settings:typography.heading_font": { kind: "root" },
  "settings:steps_card.step_number_bg_color": { kind: "part", partKey: "number" },
  "settings:steps_card.step_number_text_color": { kind: "part", partKey: "number" },
  "settings:steps_card.step_number_size": { kind: "part", partKey: "number" },
  "settings:steps_card.step_card_bg_color": { kind: "part", partKey: "card" },
  "settings:steps_card.step_card_border_radius": { kind: "part", partKey: "card" },
  "settings:layout.section_padding_top": { kind: "root" },
  "settings:layout.section_padding_right": { kind: "root" },
  "settings:layout.section_padding_bottom": { kind: "root" },
  "settings:layout.section_padding_left": { kind: "root" },
  "settings:layout.steps_gap": { kind: "part", partKey: "grid" },
  "settings:layout.content_column_width": { kind: "root" },
};

const featureListRoles: HubspotDesignRoleMap = rootOnly({
  "part:grid": { kind: "part", partKey: "grid" },
});

const tabsRoles: HubspotDesignRoleMap = {
  ...rootOnly(),
  "part:tabs": { kind: "part", partKey: "tabs" },
};

const galleryRoles: HubspotDesignRoleMap = rootOnly({
  "part:grid": { kind: "part", partKey: "grid" },
});

const logoCarouselRoles: HubspotDesignRoleMap = rootOnly({
  "part:grid": { kind: "part", partKey: "grid" },
});

const imageRoles: HubspotDesignRoleMap = rootOnly();

const headingRoles: HubspotDesignRoleMap = rootOnly();

const richTextRoles: HubspotDesignRoleMap = rootOnly();

/** Corpus-backed role → application target per native block type. */
export const HUBSPOT_DESIGN_ROLE_MAP_BY_BLOCK: Record<string, HubspotDesignRoleMap> = {
  [COUNTER_SECTION_BLOCK]: counterSectionRoles,
  [STEP_CARDS_BLOCK]: stepCardsRoles,
  [FEATURE_LIST_BLOCK]: featureListRoles,
  [TABS_BLOCK]: tabsRoles,
  [GALLERY_BLOCK]: galleryRoles,
  [LOGO_CAROUSEL_BLOCK]: logoCarouselRoles,
  [IMAGE_BLOCK]: imageRoles,
  [HEADING_BLOCK]: headingRoles,
  [RICH_TEXT_BLOCK]: richTextRoles,
};

export const hubspotDesignRoleMapForBlock = (resolvedName: string): HubspotDesignRoleMap | undefined =>
  HUBSPOT_DESIGN_ROLE_MAP_BY_BLOCK[resolvedName];
