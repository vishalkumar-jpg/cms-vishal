export {
  blockRegistry,
  blockComponents,
  REGISTERED_BLOCK_TYPES,
  type BlockComponent,
  type BlockRegistryEntry,
  type BlockCraftMeta,
} from "./registry";
export { RenderLayout, type RenderLayoutProps, type BlockMap } from "./render-layout";
export { ScopedCustomStyle, NodeScopeWrapper } from "./scoped-custom-css";
export {
  OBSiteRootBreakpointSources,
  type OBSiteRootBreakpointSource,
} from "./site-root-breakpoint-sources";
export { OBSiteRoot, type OBSiteRootProps } from "./site-root";
export { type OBViewportMode } from "./viewport-context";
export { cssFromStyles, applyRootBlockStyles, applyPartStyles, cssFromMini, mergeVisualStyles, resolveSurfaceStyles, styleModelHasVisualOverrides, splitBlockStyles, SafeLink, sanitizeText, sanitizeUrl, useMounted, cx, HighlightedText, SafeHtml, type SurfaceStyleOptions, type RootStyleOptions, type SafeLinkProps } from "./lib";
export {
  LinkRenderProvider,
  useLinkComponent,
  type InternalLinkProps,
  type LinkComponentType,
} from "./link-context";
export { BlockEditingContext, EditableText, type BlockEditingContextValue, type EditableTextProps } from "./editable-text";
export { subpartAttrs, type SubPartOptions } from "./subpart";
export {
  FormRenderContext,
  useFormRenderContext,
  type FormRenderContextValue,
  type FormDef,
  type FormFieldDef,
} from "./form-context";
export {
  ReusableBlockContext,
  useReusableBlockContext,
  type ReusableBlockRenderContextValue,
} from "./reusable-context";
export {
  fetchReusableBlockCached,
  invalidateReusableBlockCache,
} from "./reusable-fetch-cache";
export {
  CollectionRenderContext,
  useCollectionRenderContext,
  type CollectionRenderContextValue,
  type CollectionItem,
  type CollectionGetItemsOpts,
} from "./collection-context";
export {
  RepeaterItemContext,
  NodeBindingContext,
  useRepeaterItem,
  useBoundProp,
  useBoundProps,
  type RepeaterItem,
} from "./repeater-context";
export { armMobileCarousels, MOBILE_CAROUSEL_MAX_WIDTH, DEFAULT_CAROUSEL_INTERVAL_MS } from "./carousel-runtime";
export { type RenderEnv } from "./render-context";
export { renderNode, renderSubtree, type RenderNodeOpts } from "./render-layout";
export {
  STYLE_AUDIT_FIXTURE,
  STYLE_AUDIT_EXPECTED,
  STYLE_AUDIT_SKIP_TYPES,
  STYLE_AUDIT_BLOCK_COUNT,
  STYLE_AUDIT_SPLIT_SURFACE_TYPES,
  verifyStylePipeline,
  verifyElementStyles,
  verifySplitSurfaceBlock,
  buildBlockAuditEntries,
  type PipelineCheckResult,
  type DomStyleCheck,
  type BlockAuditEntry,
  type SplitSurfaceCheck,
} from "./style-verification";

// Individual blocks (re-exported for direct use / Wave 2 wrapping).
export { Section, Container, Row, Column, Grid, Slider, Spacer, Card, Group, Div, Divider } from "./blocks/layout";
export { Tabs, Accordion, Modal } from "./blocks/interactive";
export { PricingTable, TeamGrid, Timeline, Gallery, MapEmbed } from "./blocks/showcase";
export { Heading, Paragraph, SectionHeading, Image, Button, Link, Badge } from "./blocks/content";
export { OB_NAV_ITEMS, OB_STAFFING_MEGA_COLUMNS, OB_STAFFING_MOBILE_ITEMS } from "./ob-nav-data";
export { hydrateNavbarNodes, obNavbarLiveProps, ensureObHomepageNavbar } from "./hydrate-navbar";
export { hydratePartnersLogoGrid } from "./hydrate-partners";
export { Navbar, Topbar } from "./blocks/navigation";
export { NavMenu, NavLinkItem, NavDropdown, NavMega, NavMegaPanel } from "./blocks/nav-blocks";
export { Footer, FooterColumns, FooterLinks, SocialIcons, CopyrightBlock } from "./blocks/footer";
export { HeroSection, FeatureList, CounterSection, StepCards } from "./blocks/marketing";
export {
  LogoCarousel,
  ContentCarousel,
  VideoTestimonialCarousel,
  ArticleCardGrid,
} from "./blocks/carousels";
export { Form } from "./blocks/form";
export { ReusableBlock } from "./blocks/reusable";
export { CollectionList } from "./blocks/collection-list";
export { Repeater } from "./blocks/repeater";
export { Experiment } from "./blocks/experiment";
export { assignVariant, hashToUnit, type AssignVariant } from "./experiment-assign";
export { Embed } from "./blocks/embed";
export { Icon, resolveIcon, ALL_ICON_NAMES } from "./blocks/icon";
export { Video } from "./blocks/video";
export { RichText, Countdown, ProgressBar } from "./blocks/widgets";
export {
  ComparisonTable,
  BeforeAfter,
  MasonryGallery,
  CodeBlock,
  DataTable,
  NewsletterSignup,
  CookieBanner,
  FloatingCta,
  Lottie,
  Calendar,
  EventTimeline,
  StepperForm,
  DesignFrame,
  PricingCalculator,
  SocialFeed,
} from "./blocks/extended";
