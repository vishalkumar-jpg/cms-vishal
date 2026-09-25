import { Section, Container, Row, Column, Grid, Slider, Spacer, Card, Group, Div, Divider } from "./blocks/layout";
import { Tabs, Accordion, Modal } from "./blocks/interactive";
import { PricingTable, TeamGrid, Timeline, Gallery, MapEmbed } from "./blocks/showcase";
import { Heading, Paragraph, SectionHeading, Image, Button, Link, Badge } from "./blocks/content";
import { Navbar, Topbar } from "./blocks/navigation";
import { NavMenu, NavLinkItem, NavDropdown, NavMega } from "./blocks/nav-blocks";
import { Footer, FooterColumns, FooterLinks, SocialIcons, CopyrightBlock } from "./blocks/footer";
import { HeroSection, FeatureList, CounterSection, StepCards } from "./blocks/marketing";
import { LogoCarousel, ContentCarousel, VideoTestimonialCarousel, ArticleCardGrid } from "./blocks/carousels";
import { Form } from "./blocks/form";
import { CollectionList } from "./blocks/collection-list";
import { Embed } from "./blocks/embed";
import { Icon } from "./blocks/icon";
import { Video } from "./blocks/video";
import { Search } from "./blocks/search";
import { RichText, Countdown, ProgressBar } from "./blocks/widgets";
import {
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
import type { BlockComponent } from "./registry";

/**
 * Plain resolvedName → component map. Kept separate from `registry.tsx` so
 * `render-layout` and `ReusableBlock` can import it without pulling in the
 * full registry (which would create a circular init through ReusableBlock).
 */
export const blockComponents: Record<string, BlockComponent> = {
  Section,
  Container,
  Row,
  Column,
  Grid,
  Slider,
  Spacer,
  Card,
  Group,
  Div,
  Tabs,
  Accordion,
  Modal,
  "Pricing Table": PricingTable,
  "Team Grid": TeamGrid,
  Timeline,
  Gallery,
  Map: MapEmbed,
  Footer,
  "Footer Columns": FooterColumns,
  "Hero Section": HeroSection,
  Navbar,
  Topbar,
  NavMenu,
  "Nav Link": NavLinkItem,
  "Nav Dropdown": NavDropdown,
  "Nav Mega": NavMega,
  Heading,
  Paragraph,
  Image,
  Button,
  "Section Heading": SectionHeading,
  "Feature List": FeatureList,
  "Counter Section": CounterSection,
  "Step Cards": StepCards,
  "Logo Carousel": LogoCarousel,
  "Video Testimonial Carousel": VideoTestimonialCarousel,
  "Content Carousel": ContentCarousel,
  "Article Card Grid": ArticleCardGrid,
  "Footer Links": FooterLinks,
  "Social Icons": SocialIcons,
  Link,
  Badge,
  Divider,
  "Copyright Block": CopyrightBlock,
  Form,
  "Collection List": CollectionList,
  Embed,
  Icon,
  Video,
  Search,
  "Rich Text": RichText,
  Countdown,
  "Progress Bar": ProgressBar,
  "Comparison Table": ComparisonTable,
  "Before / After": BeforeAfter,
  "Masonry Gallery": MasonryGallery,
  "Code Block": CodeBlock,
  Table: DataTable,
  Newsletter: NewsletterSignup,
  "Cookie Banner": CookieBanner,
  "Floating CTA": FloatingCta,
  Lottie,
  Calendar,
  "Event Timeline": EventTimeline,
  "Stepper Form": StepperForm,
  "Design Frame": DesignFrame,
  "Pricing Calculator": PricingCalculator,
  "Social Feed": SocialFeed,
};
