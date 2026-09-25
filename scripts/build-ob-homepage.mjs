/**
 * Generates a fully-primitive Craft.js SerializedLayout that mirrors the
 * Office Beacon homepage (www.officebeacon.com) 1:1 — every visible element is
 * an independently editable node (Section/Container/Row/Column/Grid/Div/
 * Heading/Paragraph/Button/Image/Link/Video/Icon/Divider). Text, image URLs and
 * video URLs are taken verbatim from the saved homepage markup.
 *
 * Run:  bun scripts/build-ob-homepage.mjs
 * Writes: apps/admin/src/views/builder/sections/obHomepage.json
 *         officebeacon-homepage.json (repo root, for reference/import)
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ---------- palette ---------- */
const NAVY = "#002244";
const BLUE = "#147eff";
const BLUE_DARK = "#0a5cd8";
const GREY = "#6c7c93";
const YELLOW = "#ffb612";
const WHITE = "#ffffff";

/* Office Beacon brand type: geometric sans for a modern, friendly voice. */
const FONT = "Poppins, 'Segoe UI', system-ui, sans-serif";

/* Full OB navbar structure — dropdowns, mega-menu, mobile nested menus */
const OB_NAV_ITEMS = [
  {
    label: "Solutions",
    items: [
      { label: "Boost Sales & Market Reach", url: "https://www.officebeacon.com/solutions/boost-sales-and-reach" },
      { label: "Reduce Costs & Overhead", url: "https://www.officebeacon.com/solutions/reduce-cost-overhead" },
      { label: "Save Time & Increase Efficiency", url: "https://www.officebeacon.com/solutions/save-time-increase-efficiency" },
      { label: "Strengthen Security & Compliance", url: "https://www.officebeacon.com/solutions/security-compliance" },
      { label: "Strategic Partnerships", url: "https://www.officebeacon.com/solutions/member-partnerships" },
    ],
  },
  {
    label: "Staffing Services",
    menuColumns: [
      {
        title: "Back Office Operations",
        url: "https://www.officebeacon.com/services/backoffice-operations-virtual-assistant/",
        links: [
          { label: "Virtual Assistant", url: "https://www.officebeacon.com/services/virtual-assistant/" },
          { label: "Logistics Support", url: "https://www.officebeacon.com/services/logistics-support-virtual-assistant/" },
          { label: "Call Center", url: "https://www.officebeacon.com/services/call-center-virtual-assistant/" },
          { label: "Data Entry", url: "https://www.officebeacon.com/services/data-entry-virtual-assistant/" },
          { label: "AI Workflows", url: "https://www.officebeacon.com/services/ai-workflows-virtual-assistant/" },
          { label: "Project Management", url: "https://www.officebeacon.com/services/project-management-virtual-assistant/" },
        ],
      },
      {
        title: "Administrative Support",
        url: "https://www.officebeacon.com/services/administrative-support-virtual-assistant/",
        links: [
          { label: "Finance and Accounting", url: "https://www.officebeacon.com/services/finance-accounting-virtual-assistant/" },
          { label: "Legal Assistants", url: "https://www.officebeacon.com/services/legal-virtual-assistant/" },
          { label: "Human Resources", url: "https://www.officebeacon.com/services/human-resource-virtual-assistant/" },
          { label: "Interpretation Services", url: "https://www.officebeacon.com/services/language-translation-virtual-assistant/" },
        ],
      },
      {
        title: "All Industries",
        url: "https://www.officebeacon.com/industries",
        links: [
          { label: "Insurance", url: "https://www.officebeacon.com/industries/insurance-remote-staffing/" },
          { label: "Promotional Products", url: "https://www.officebeacon.com/industries/promotional-products-remote-staffing/" },
          { label: "Finance & Accounting", url: "https://www.officebeacon.com/industries/finance-accounting-remote-staffing/" },
          { label: "Healthcare", url: "https://www.officebeacon.com/industries/healthcare-remote-staffing/" },
          { label: "Legal", url: "https://www.officebeacon.com/industries/legal-remote-staffing/" },
          { label: "Property Management", url: "https://www.officebeacon.com/industries/property-management-remote-staffing/" },
          { label: "Construction", url: "https://www.officebeacon.com/industries/construction-remote-staffing/" },
          { label: "View All Industries", url: "https://www.officebeacon.com/industries/" },
        ],
      },
      {
        title: "Marketing, Sales & CRM Support",
        url: "https://www.officebeacon.com/services/marketing-sales-crm-support-virtual-assistant/",
        links: [
          { label: "Webstore and Website Management", url: "https://www.officebeacon.com/services/webstore-website-management-virtual-assistant/" },
          { label: "Sales Support and Lead Generation", url: "https://www.officebeacon.com/services/sales-support-lead-generation-virtual-assistant/" },
          { label: "Marketing Support", url: "https://www.officebeacon.com/services/marketing-support-virtual-assistant/" },
          { label: "Creative Design & Editing", url: "https://www.officebeacon.com/services/creative-design-editing-virtual-assistant/" },
        ],
      },
      {
        title: "Technical Support",
        url: "https://www.officebeacon.com/services/technical-support-virtual-assistant/",
        links: [
          { label: "Software Development", url: "https://www.officebeacon.com/services/software-development-virtual-assistant/" },
          { label: "IT Services", url: "https://www.officebeacon.com/services/devops-it-services-virtual-assistant/" },
          { label: "Cybersecurity & Compliance (iSecurify)", url: "https://www.officebeacon.com/services/cybersecurity-compliance-virtual-assistant/" },
        ],
      },
    ],
    items: [
      {
        label: "Backoffice Operations",
        url: "https://www.officebeacon.com/services/backoffice-operations-virtual-assistant/",
        items: [
          { label: "Virtual Assistant", url: "https://www.officebeacon.com/services/virtual-assistant/" },
          { label: "Logistics Support", url: "https://www.officebeacon.com/services/logistics-support-virtual-assistant/" },
          { label: "Call Center", url: "https://www.officebeacon.com/services/call-center-virtual-assistant/" },
          { label: "Data Entry", url: "https://www.officebeacon.com/services/data-entry-virtual-assistant/" },
          { label: "AI Workflows", url: "https://www.officebeacon.com/services/ai-workflows-virtual-assistant/" },
          { label: "Project Management", url: "https://www.officebeacon.com/services/project-management-virtual-assistant/" },
        ],
      },
      {
        label: "Administrative Support",
        url: "https://www.officebeacon.com/services/administrative-support-virtual-assistant/",
        items: [
          { label: "Finance and Accounting", url: "https://www.officebeacon.com/services/finance-accounting-virtual-assistant/" },
          { label: "Legal Assistants", url: "https://www.officebeacon.com/services/legal-virtual-assistant/" },
          { label: "Human Resources", url: "https://www.officebeacon.com/services/human-resource-virtual-assistant/" },
          { label: "Interpretation Services", url: "https://www.officebeacon.com/services/language-translation-virtual-assistant/" },
        ],
      },
      {
        label: "Marketing, Sales & CRM Support",
        url: "https://www.officebeacon.com/services/marketing-sales-crm-support-virtual-assistant/",
        items: [
          { label: "Webstore and Website Management", url: "https://www.officebeacon.com/services/webstore-website-management-virtual-assistant/" },
          { label: "Sales Support and Lead Generation", url: "https://www.officebeacon.com/services/sales-support-lead-generation-virtual-assistant/" },
          { label: "Marketing Support", url: "https://www.officebeacon.com/services/marketing-support-virtual-assistant/" },
          { label: "Creative Design & Editing", url: "https://www.officebeacon.com/services/creative-design-editing-virtual-assistant/" },
        ],
      },
      {
        label: "Technical Support",
        url: "https://www.officebeacon.com/services/technical-support-virtual-assistant/",
        items: [
          { label: "Software Development", url: "https://www.officebeacon.com/services/software-development-virtual-assistant/" },
          { label: "IT Services", url: "https://www.officebeacon.com/services/devops-it-services-virtual-assistant/" },
          { label: "Cybersecurity & Compliance (iSecurify)", url: "https://www.officebeacon.com/services/cybersecurity-compliance-virtual-assistant/" },
        ],
      },
      { label: "View All Services", url: "https://www.officebeacon.com/services/" },
    ],
  },
  {
    label: "All Industries",
    items: [
      { label: "Insurance", url: "https://www.officebeacon.com/industries/insurance-remote-staffing/" },
      { label: "Promotional Products", url: "https://www.officebeacon.com/industries/promotional-products-remote-staffing/" },
      { label: "Finance & Accounting", url: "https://www.officebeacon.com/industries/finance-accounting-remote-staffing/" },
      { label: "Healthcare", url: "https://www.officebeacon.com/industries/healthcare-remote-staffing/" },
      { label: "Legal", url: "https://www.officebeacon.com/industries/legal-remote-staffing/" },
      { label: "Property Management", url: "https://www.officebeacon.com/industries/property-management-remote-staffing/" },
      { label: "Construction", url: "https://www.officebeacon.com/industries/construction-remote-staffing/" },
      { label: "View All Industries", url: "https://www.officebeacon.com/industries/" },
    ],
  },
  { label: "How It Works", url: "/how-it-works" },
  {
    label: "About",
    items: [
      { label: "Why Office Beacon?", url: "https://www.officebeacon.com/why-office-beacon/" },
      { label: "Team", url: "https://www.officebeacon.com/team" },
      { label: "Data Protection - Certifications", url: "https://www.officebeacon.com/certification-data-protection" },
      { label: "Office Locations", url: "https://www.officebeacon.com/delivery-centers" },
      { label: "News", url: "https://www.officebeacon.com/press-release/" },
    ],
  },
  { label: "Events", url: "https://events.officebeacon.com/" },
  { label: "Careers", url: "https://www.officebeacon.com/careers" },
];

/* Gradient background helper — StyleModel colors.backgroundGradient shape. */
const bgGrad = (angle, stops) => ({ colors: { backgroundGradient: { type: "linear", angle, stops } } });

/* ---------- tree helpers (plain nodes, flattened later) ---------- */
const CANVAS = new Set(["Section", "Container", "Row", "Column", "Grid", "Slider", "Div"]);
const node = (type, props = {}, children = []) => ({ type, props, children });

const section = (styles, children, className) =>
  node("Section", { styles, ...(className ? { className } : {}) }, children);
const container = (children, styles = {}, maxWidth = 1280, className) =>
  node("Container", { maxWidth, styles: { sizing: { maxWidth }, ...styles }, ...(className ? { className } : {}) }, children);
const row = (children, styles = {}, className) =>
  node("Row", { styles, ...(className ? { className } : {}) }, children);
const col = (children, flex, styles = {}, className) =>
  node("Column", { flex, styles, ...(className ? { className } : {}) }, children);
const grid = (children, columns = 3, styles = {}, className) =>
  node("Grid", { columns, styles, ...(className ? { className } : {}) }, children);
const div = (children, styles = {}, className) =>
  node("Div", { styles, ...(className ? { className } : {}) }, children);
/** Node-based swipe track. Each child is one slide (use div slides, not columns,
 *  so the slider's CSS controls slide width instead of Column's flex:1). */
const slider = (children, slidesVisible = 3, gap = 32, styles = {}, className) =>
  node("Slider", { slidesVisible, gap, showArrows: true, styles, ...(className ? { className } : {}) }, children);

const heading = (text, level, styles = {}, extra = {}) =>
  node("Heading", { text, level, styles, ...extra }, []);
const para = (text, styles = {}) => node("Paragraph", { text, styles }, []);
const btn = (label, url, opts = {}) =>
  node("Button", { label, url, variant: opts.variant ?? "primary", iconAfter: opts.iconAfter, partStyles: opts.partStyles ?? {}, styles: opts.styles ?? {} }, []);
const image = (imageUrl, altText, opts = {}) =>
  node("Image", {
    imageUrl, altText: altText ?? "",
    width: opts.width ?? "100%",
    imageStyles: opts.imageStyles ?? {},
    styles: opts.styles ?? (opts.maxWidth ? { sizing: { maxWidth: opts.maxWidth } } : {}),
    ...(opts.url ? { url: opts.url } : {}),
    loading: opts.loading ?? "lazy",
  }, []);
const link = (text, url, linkStyles = {}) => node("Link", { text, url, linkStyles }, []);
const video = (src, poster) => node("Video", { src, poster, provider: "auto", controls: true }, []);
const icon = (name, size = 40, color = BLUE) => node("Icon", { name, size, color }, []);
const divider = (color, thickness = 1, styles = {}) => node("Divider", { color, thickness, styles }, []);

/* ---------- style shorthands ---------- */
const pad = (t, r, b, l) => ({ spacing: { paddingTop: t, paddingRight: r ?? t, paddingBottom: b ?? t, paddingLeft: l ?? r ?? t } });
/** Responsive section padding — desktop / tablet / mobile. */
const responsivePad = (desktop, tablet, mobile) => ({
  spacing: {
    paddingTop: desktop[0],
    paddingRight: desktop[1] ?? desktop[0],
    paddingBottom: desktop[2] ?? desktop[0],
    paddingLeft: desktop[3] ?? desktop[1] ?? desktop[0],
  },
  responsive: {
    tablet: {
      spacing: {
        paddingTop: tablet[0],
        paddingRight: tablet[1] ?? tablet[0],
        paddingBottom: tablet[2] ?? tablet[0],
        paddingLeft: tablet[3] ?? tablet[1] ?? tablet[0],
      },
    },
    mobile: {
      spacing: {
        paddingTop: mobile[0],
        paddingRight: mobile[1] ?? mobile[0],
        paddingBottom: mobile[2] ?? mobile[0],
        paddingLeft: mobile[3] ?? mobile[1] ?? mobile[0],
      },
    },
    __auto: { tablet: false, mobile: false },
  },
});
const bg = (c) => ({ colors: { backgroundColor: c } });
const flexRow = (justify = "flex-start", align = "center", gap = 16, wrap = "wrap") =>
  ({ layout: { display: "flex", flexDirection: "row", justifyContent: justify, alignItems: align, flexWrap: wrap }, spacing: { gap } });
const flexCol = (align = "flex-start", gap = 16) =>
  ({ layout: { display: "flex", flexDirection: "column", alignItems: align }, spacing: { gap } });
const type = (o) => ({ typography: o });
const merge = (...objs) => {
  const out = {};
  for (const o of objs) for (const [k, v] of Object.entries(o)) out[k] = { ...(out[k] || {}), ...v };
  return out;
};

/* =================================================================== */
/* SECTIONS                                                            */
/* =================================================================== */
const sections = [];

/* 1. Topbar (blue) */
sections.push(
  section(merge(bg(BLUE), pad(8, 24)),
    [container([
      row([link("Log In", "https://app.officebeacon.com/ecommpay/cregistration1.aspx", { color: WHITE, fontSize: 14, textDecoration: "none" })],
        flexRow("flex-end", "center", 20))
    ])]
  )
);

/* 2. Navbar (white) — Navbar block with hamburger on tablet/mobile */
sections.push(
  node("Navbar", {
    logoImage: "https://www.officebeacon.com/hs-fs/hubfs/office-beacon/logos/OB%20Logo%20Colour.png?width=350&height=76&name=OB%20Logo%20Colour.png",
    logoUrl: "/ob-homepage",
    logoText: "Office Beacon",
    logoImageHeight: 56,
    sticky: true,
    navItems: OB_NAV_ITEMS,
    linkStyles: { color: GREY, fontSize: 16 },
    ctaText: "Get Started",
    ctaUrl: "https://www.officebeacon.com/lp/build-your-remote-team",
    showCta: true,
    ctaStyles: { background: BLUE, color: WHITE, paddingX: 20, paddingY: 10, borderRadius: 8 },
    styles: merge(
      bg(WHITE),
      pad(16, 24),
      { effects: {} },
      { shadows: { boxShadow: "0px 1px 0px 0px rgba(108,124,147,0.1)" } },
    ),
  }, [])
);

/* 3. Hero */
sections.push(
  section(merge(
    bgGrad(160, [
      { color: "#e8f2ff", position: 0 },
      { color: "#ffffff", position: 100 },
    ]),
    responsivePad([120, 24, 120, 24], [80, 24, 80, 24], [48, 16, 48, 16]),
  ),
    [container([
      row([
        col([
          heading("Remote Teams That Feel In-House.", 1,
            merge(type({ fontSize: 56, fontWeight: 700, lineHeight: 1.1, color: NAVY }), { spacing: { marginBottom: 16 } }),
            { highlightText: "That Feel In-House.", highlightColor: BLUE }),
          para("Scale with AI+Human hybrid teams that follow your systems, meet your standards, and deliver results—without adding overhead.",
            merge(type({ fontSize: 20, color: GREY }), { spacing: { marginBottom: 24 } })),
          btn("Start Your Transformation", "https://www.officebeacon.com/lp/build-your-remote-team", { iconAfter: "→", partStyles: { padding: "16px 28px" } }),
          divider("rgba(0,34,68,0.1)", 1, { spacing: { marginTop: 32, marginBottom: 24 } }),
          image("https://www.officebeacon.com/hubfs/website/assets/trustpilot-logo.svg", "trustpilot-logo",
            { url: "https://www.trustpilot.com/review/officebeacon.com", maxWidth: 300 }),
        ], 7, flexCol("flex-start", 8)),
        col([
          image("https://www.officebeacon.com/hs-fs/hubfs/website/images/0-0_Homepage/OBHero_1_Lady_Smiling_optimised.webp?width=450&height=450&name=OBHero_1_Lady_Smiling_optimised.webp",
            "Hire Remote Virtual Assistants", { maxWidth: 450, loading: "eager", imageStyles: { borderRadius: 12 } }),
        ], 5, flexCol("center", 8)),
      ], flexRow("space-between", "center", 40, "wrap"), "hero-split-grid cms-hero-split"),
    ])]
  )
);

/* 4. Save 40% (image | copy) */
sections.push(
  section(merge(bg("#f0f7ff"), responsivePad([64, 24, 64, 24], [56, 24, 56, 24], [40, 16, 40, 16])),
    [container([
      row([
        col([image("https://www.officebeacon.com/hs-fs/hubfs/Client%20Testimonials/2-1-6_AI-Workflows_4-3_04_test_copy.webp",
          "Outsourcing AI Virtual Assistant Services", { maxWidth: 551, imageStyles: { borderRadius: 12 } })], 6),
        col([
          heading("Save 40% on Staffing Without Losing Speed or Control", 2,
            merge(type({ fontSize: 36, fontWeight: 700, lineHeight: 1.2, color: NAVY }), { spacing: { marginBottom: 16 } })),
          para("Office Beacon’s AI+Human hybrid teams help you spend smarter, expand coverage, and maintain enterprise-grade standards. Our trained professionals integrate fast, follow your workflows, and deliver consistent results so that you can scale without the delays or overhead of traditional hiring.",
            type({ fontSize: 20, color: GREY })),
        ], 6, flexCol("flex-start", 8)),
      ], flexRow("space-between", "center", 40), "ob-split-row"),
    ])]
  )
);

/* 5. Built For Startups, Ops Leaders, and Enterprises */
const audienceCard = (img, alt, title, text) =>
  col([
    image(img, alt, { imageStyles: { borderRadius: 12 } }),
    heading(title, 5, merge(type({ fontSize: 22, fontWeight: 700, color: NAVY }), { spacing: { marginTop: 16, marginBottom: 8 } })),
    para(text, type({ fontSize: 16, color: GREY })),
  ], 1, flexCol("flex-start", 4));

sections.push(
  section(merge(bg("#f0f7ff"), responsivePad([64, 24, 64, 24], [56, 24, 56, 24], [40, 16, 40, 16])),
    [container([
      heading("Built For Startups, Ops Leaders, and Enterprises", 2,
        merge(type({ fontSize: 36, fontWeight: 700, color: NAVY, textAlign: "center" }), { spacing: { marginBottom: 40 } })),
      grid([
        audienceCard("https://www.officebeacon.com/hubfs/website/placeholders/images/card-operations.jpg", "card-operations",
          "Startups & Small Businesses", "Delegate operations, admin, and support with hybrid teams that feel in-house—so you stay focused on growth, not overhead."),
        audienceCard("https://www.officebeacon.com/hubfs/website/placeholders/images/card-executives.jpg", "card-executives",
          "Ops Leaders", "Plug into your existing systems with trained professionals who follow your lead and deliver results from day one."),
        audienceCard("https://www.officebeacon.com/hubfs/website/placeholders/images/card-enterprise-1.jpg", "Hire Virtual Assistants Service",
          "Enterprise Teams", "Expand coverage across departments with hybrid teams that meet compliance standards and scale securely."),
      ], 3, merge({ layout: { gridTemplateColumns: "repeat(3, 1fr)" }, spacing: { gap: 32 } }), "ob-grid-cols-3"),
    ])]
  )
);

/* 6. Press (image | copy) */
sections.push(
  section(merge(bg(WHITE), responsivePad([50, 24, 50, 24], [48, 24, 48, 24], [32, 16, 32, 16])),
    [container([
      row([
        col([image("https://www.officebeacon.com/hubfs/TalkerSurvey_Homepage_1280x960.jpg", "Outsourcing Press Services", { maxWidth: 1280, imageStyles: { borderRadius: 12 } })], 6),
        col([
          para("For the Press", merge(type({ fontSize: 16, fontWeight: 700, color: BLUE }), { spacing: { marginBottom: 8 } })),
          heading("Office Beacon CEO Featured in Talker News Workplace Study", 2,
            merge(type({ fontSize: 34, fontWeight: 700, lineHeight: 1.2, color: NAVY }), { spacing: { marginBottom: 16 } })),
          para("Talker News' viral study on \"voluntold\" work commissioned by Office Beacon includes insights from our CEO, Pranav Dalal.",
            merge(type({ fontSize: 16, color: GREY }), { spacing: { marginBottom: 12 } })),
          para("Journalists and editors are encouraged to connect with Office Beacon for expert commentary on the workplace balance and scaling findings in this study by Talker Research.",
            merge(type({ fontSize: 16, color: GREY }), { spacing: { marginBottom: 16 } })),
          btn("Access the Study", "https://www.officebeacon.com/voluntold-work-impacting-employees-talker-research-study-office-beacon", { variant: "secondary" }),
        ], 6, flexCol("flex-start", 4)),
      ], flexRow("space-between", "center", 40), "ob-split-row"),
    ])]
  )
);

/* 7. Strategic partnerships + logo strip */
const partnerLogos = [
  ["https://www.officebeacon.com/hs-fs/hubfs/website/assets/1-5_Member-Partnerships/1-5_sofi-stadium.jpg?width=225&height=225&name=1-5_sofi-stadium.jpg", "1-5_sofi-stadium"],
  ["https://www.officebeacon.com/hs-fs/hubfs/website/assets/partners-logos/EO_Orange1_480x270%20(1).jpg?width=225&height=126&name=EO_Orange1_480x270%20(1).jpg", "EO_Orange_County_logo"],
  ["https://www.officebeacon.com/hs-fs/hubfs/website/assets/1-5_Member-Partnerships/1-5_vistage.jpg?width=225&height=225&name=1-5_vistage.jpg", "1-5_vistage"],
  ["https://www.officebeacon.com/hs-fs/hubfs/website/assets/partners-logos/promotional-products-print/facilis-group-logo.png?width=225&height=225&name=facilis-group-logo.png", "facilis-group-logo"],
  ["https://www.officebeacon.com/hs-fs/hubfs/website/assets/1-5_Member-Partnerships/1-5_intuit-dome.jpg?width=225&height=225&name=1-5_intuit-dome.jpg", "1-5_intuit-dome"],
].map(([u, a]) => col([image(u, a, { imageStyles: { borderRadius: 8 } })], 1, flexCol("center", 0)));

sections.push(
  section(merge(bg(WHITE), pad(32, 24)),
    [container([
      row([
        col([heading("Meet our strategic partnerships", 3, type({ fontSize: 28, fontWeight: 700, color: NAVY }))], 7),
        col([btn("See All Partners", "https://www.officebeacon.com/solutions/member-partnerships", { variant: "secondary" })], 5, flexCol("flex-end", 0)),
      ], flexRow("space-between", "center", 24)),
      grid(partnerLogos, 5, merge({ layout: { gridTemplateColumns: "repeat(5, 1fr)" }, spacing: { gap: 18 }, }, { spacing: { gap: 18, marginTop: 24 } }), "ob-grid-cols-5 ob-partners-logo-grid ob-no-auto-loop"),
    ], merge({ sizing: { maxWidth: 1400 } }), 1400)]
  )
);

/* 8. What they say (testimonials) */
const videoCard = (poster, mp4, title, sub) =>
  div([
    div([video(mp4, poster)], merge({ borders: { borderRadius: 12 }, effects: {} })),
    heading(title, 6, merge(type({ fontSize: 16, fontWeight: 700, color: NAVY }), { spacing: { marginTop: 12 } })),
    para(sub, type({ fontSize: 14, color: GREY })),
  ], flexCol("flex-start", 4));

const quoteCard = (headshot, quote, name, position) =>
  div([
    icon("Quote", 32, BLUE),
    para(quote, merge(type({ fontSize: 15, color: NAVY, lineHeight: 1.6 }), { spacing: { marginTop: 8 } })),
    row([
      image(headshot, name, { maxWidth: 56, imageStyles: { borderRadius: 999 } }),
      heading(`${name} — ${position}`, 6, type({ fontSize: 14, fontWeight: 700, color: NAVY })),
    ], merge(flexRow("flex-start", "center", 12), { spacing: { gap: 12, marginTop: 12 } })),
  ], flexCol("flex-start", 4));

const heatherQuote =
  "We partnered with Office Beacon hoping to fill a need on our sales team. What we found was so much more. Our South Africa-based virtual team member, Alta, has become a genuine part of our culture at My Brand. She participates fully in everything we do — not as a remote resource, but as a real teammate. That became clear in the most unexpected and moving way. When My Brand launched our annual charity drive last December, Alta wanted to participate. Currency exchange made direct donation difficult — so we suggested choosing a local charity to support. She did far more than that. Alta reached out to Office Beacon and initiated a charity drive for Gift a Child Children's Home. The cause was personal: On her son’s first birthday, she took her kids to donate to children's homes in gratitude — and one home, despite having very little, left an indelible mark on her heart. When given the chance to choose a charity for this initiative, she chose them immediately. What began as one person's desire to participate became a fully coordinated, cross-office initiative spanning two continents with the Office Beacon team and the My Brand team supporting this heartfelt and important initiative. This is what remote staffing looks like when it's done right — not transactional, but fully integrated, values-aligned, and deeply human. We couldn't be prouder to be part of this story.";

sections.push(
  section(merge(bg(WHITE), pad(40, 24)),
    [container([
      heading("What they say about Office Beacon", 2,
        merge(type({ fontSize: 36, fontWeight: 700, color: NAVY }), { spacing: { marginBottom: 32 } }),
        { highlightText: "Office Beacon", highlightColor: BLUE }),
      slider([
        videoCard("https://www.officebeacon.com/hubfs/Client%20Testimonials/Dave%20Williams%20Thumbnail%20With%20Text.png",
          "https://23629617.fs1.hubspotusercontent-na1.net/hubfs/23629617/Client%20Testimonials/Dave%20Williams.mp4",
          "Dave Williams", "Farmer’s Insurance Agency Owner"),
        quoteCard("https://www.officebeacon.com/hubfs/Headshot%20Heather%20Mueller.jpg", heatherQuote,
          "Heather Mueller", "Talent & Knowledge Manager, My Brand"),
        videoCard("https://www.officebeacon.com/hubfs/Client%20Testimonials/Logo%20Mark%20(Erol)%20Thumbnail.png",
          "https://23629617.fs1.hubspotusercontent-na1.net/hubfs/23629617/Client%20Testimonials/Logo%20Mark%20v2.mp4",
          "Errol", "SVP Operations and Production"),
        quoteCard("https://www.officebeacon.com/hubfs/Client%20Testimonials/Bill_Korowitz%20copy.webp",
          "I wish it were only me using Office Beacon and not my competitors. We bought six companies and each company we buy we have integrated Office Beacon into them.",
          "Bill Korowitz", "CEO, The Magnet Group"),
        videoCard("https://www.officebeacon.com/hubfs/Client%20Testimonials/Logo%20Mark%20(Shaun)%20Thumbnail.png",
          "https://23629617.fs1.hubspotusercontent-na1.net/hubfs/23629617/Client%20Testimonials/Logo%20Mark%20(Shaun).mp4",
          "Shaun", "Customer Service Manager"),
      ], 3, 32, {}, "ob-testimonials-slider"),
    ])]
  )
);

/* 9. What We Do — AI+Human Hybrid Service (6 service cards) */
const serviceCard = (iconName, title, url, text) =>
  col([
    icon(iconName, 56, BLUE),
    heading(title, 4, merge(type({ fontSize: 22, fontWeight: 700, color: NAVY }), { spacing: { marginTop: 12, marginBottom: 8 } }),
      { }),
    para(text, type({ fontSize: 16, color: GREY })),
    link("Learn more", url, { color: BLUE, fontSize: 15 }),
  ], 1, flexCol("flex-start", 6));

sections.push(
  section(merge(bg("#f0f7ff"), pad(64, 24)),
    [container([
      para("What We Do:", merge(type({ fontSize: 16, fontWeight: 700, color: BLUE, textAlign: "center" }), { spacing: { marginBottom: 8 } })),
      heading("AI+Human Hybrid Service", 2,
        merge(type({ fontSize: 36, fontWeight: 700, color: NAVY, textAlign: "center" }), { spacing: { marginBottom: 40 } })),
      grid([
        serviceCard("Users", "Back Office Operations", "https://www.officebeacon.com/services/backoffice-operations-virtual-assistant/",
          "Streamline admin, finance, and support with remote teams trained to follow your workflows and deliver consistent results."),
        serviceCard("TrendingUp", "Sales and CRM Support", "https://www.officebeacon.com/services/marketing-sales-crm-support-virtual-assistant/",
          "Boost pipeline efficiency with hybrid teams that manage outreach, CRM updates, and reporting—without adding headcount."),
        serviceCard("ShieldCheck", "Security & Compliance", "https://www.officebeacon.com/services/cybersecurity-compliance-virtual-assistant/",
          "Protect your data and workflows with remote teams trained in enterprise-grade compliance and secure operations."),
        serviceCard("ClipboardList", "Administrative Support", "https://www.officebeacon.com/services/administrative-support-virtual-assistant/",
          "Delegate calendar, inbox, and task management to virtual assistants who integrate fast and stay accountable."),
        serviceCard("Laptop", "Virtual Assistant", "https://www.officebeacon.com/services/virtual-assistant/",
          "Get AI-enhanced virtual assistants who manage your day-to-day with speed, precision, and zero onboarding drag."),
        serviceCard("Megaphone", "Marketing Support", "https://www.officebeacon.com/services/marketing-support-virtual-assistant/",
          "Run campaigns at scale with hybrid teams that combine AI insights and human creativity for maximum ROI."),
      ], 3, merge({ layout: { gridTemplateColumns: "repeat(3, 1fr)" }, spacing: { gap: 32 } }), "ob-grid-cols-3"),
    ])]
  )
);

/* 10. CTA banner (SoFi Stadium interactive) */
sections.push(
  section(merge(bg("#0a1f44"), pad(64, 24)),
    [container([
      div([
        heading("Network Like a VIP at SoFi Stadium", 2, type({ fontSize: 32, fontWeight: 700, color: WHITE, textAlign: "center" })),
        btn("Learn More", "https://www.officebeacon.com/", { partStyles: { padding: "14px 28px" } }),
      ], merge(flexCol("center", 20)))
    ])]
  )
);

/* 11. Proof Backed by the Numbers (navy/blue) */
const statCardStyle = merge(
  flexCol("center", 4),
  pad(32, 28),
  {
    colors: {
      backgroundGradient: {
        type: "linear",
        angle: 180,
        stops: [
          { color: "rgba(255,255,255,0.18)", position: 0 },
          { color: "rgba(255,255,255,0.08)", position: 100 },
        ],
      },
    },
    borders: {
      borderRadius: 16,
      borderColor: "rgba(255,255,255,0.28)",
      borderWidth: 1,
      borderStyle: "solid",
    },
    effects: { backdropBlur: 12 },
  },
);

const counter = (num, suffix, title, desc) =>
  col([
    row([
      heading(num, 2, type({ fontSize: 64, fontWeight: 700, color: WHITE, lineHeight: 1 }), {
        countUp: true,
        countUpDuration: 2000,
      }),
      heading(suffix, 3, type({ fontSize: 28, fontWeight: 700, color: WHITE })),
    ], merge(flexRow("center", "baseline", 4, "nowrap"), { spacing: { gap: 4 } }), "ob-stat-value-row"),
    heading(title, 4, merge(type({ fontSize: 30, fontWeight: 700, color: WHITE, textAlign: "center" }), { spacing: { marginTop: 8, marginBottom: 8 } })),
    para(desc, type({ fontSize: 16, color: WHITE, textAlign: "center" })),
  ], 1, statCardStyle, "ob-stat-card cms-auto-col");

sections.push(
  section(merge(bgGrad(135, [
      { color: BLUE, position: 0 },
      { color: BLUE_DARK, position: 100 },
    ]), pad(64, 24)),
    [container([
      heading("Proof Backed by the Numbers", 2,
        merge(type({ fontSize: 36, fontWeight: 700, color: WHITE, textAlign: "center" }), { spacing: { marginBottom: 32 } })),
      grid([
        counter("40", "%", "Avg. Cost Savings", "Clients reduce overhead and scale faster by replacing traditional hiring with hybrid teams that deliver more efficiently."),
        counter("24", "/7", "Global Coverage", "Our remote teams operate across time zones, ensuring round-the-clock support without burnout or bottlenecks."),
        counter("4,000", "+", "Businesses Served", "From startups to enterprises, thousands trust Office Beacon to support growth, protect margins, and deliver results."),
      ], 3, merge({ layout: { gridTemplateColumns: "repeat(3, 1fr)" }, spacing: { gap: 32 } }), "ob-grid-cols-3 ob-stats-grid"),
    ])]
  )
);

/* 12. Watch demo CTA card — HIDDEN on live page (display:none) */
const hiddenDemoCard = section(merge(bg("#f0f7ff"), pad(64, 24)),
  [container([
    div([
      heading("Watch How Hybrid Teams Drive Real Results", 2, type({ fontSize: 32, fontWeight: 700, color: NAVY, textAlign: "center" })),
      para("See how OB’s AI+Human model helps businesses grow faster, spend smarter, and stay compliant.",
        type({ fontSize: 20, color: GREY, textAlign: "center" })),
      btn("Watch the Demo", "https://www.officebeacon.com/", {}),
    ], flexCol("center", 16))
  ], merge({ sizing: { maxWidth: 960 } }), 960)]);
hiddenDemoCard.hidden = true;
sections.push(hiddenDemoCard);

/* 13. 25 Years (image | copy) */
sections.push(
  section(merge(bg("#f0f7ff"), responsivePad([64, 24, 64, 24], [56, 24, 56, 24], [40, 16, 40, 16])),
    [container([
      row([
        col([image("https://www.officebeacon.com/hubfs/website/placeholders/images/section-company-history.jpg",
          "Remote Operational Support", { imageStyles: { borderRadius: 12 } })], 6),
        col([
          heading("25 Years of Scaling Businesses. Now Even Smarter.", 2,
            merge(type({ fontSize: 36, fontWeight: 700, lineHeight: 1.2, color: NAVY }), { spacing: { marginBottom: 16 } }),
            { highlightText: "25 Years of Scaling Businesses.", highlightColor: BLUE }),
          para("Office Beacon has helped thousands of businesses grow through reliable, remote operational support. Today, we’ve evolved that model—combining trained professionals with AI-enhanced systems to deliver faster, more precise results across every function.",
            type({ fontSize: 20, color: GREY })),
        ], 6, flexCol("flex-start", 8)),
      ], flexRow("space-between", "center", 40), "ob-split-row"),
    ])]
  )
);

/* 14. Security You Can Count On (3 cards) */
const securityCard = (iconName, title, text) =>
  col([
    icon(iconName, 48, BLUE),
    heading(title, 5, merge(type({ fontSize: 20, fontWeight: 700, color: NAVY, textAlign: "center" }), { spacing: { marginTop: 12, marginBottom: 8 } })),
    para(text, type({ fontSize: 16, color: GREY, textAlign: "center" })),
  ], 1, flexCol("center", 6));

sections.push(
  section(merge(bg(WHITE), pad(64, 24)),
    [container([
      heading("Security You Can Count On", 3,
        merge(type({ fontSize: 28, fontWeight: 700, color: NAVY, textAlign: "center" }), { spacing: { marginBottom: 40 } })),
      grid([
        securityCard("ShieldCheck", "SOC 2 Compliance", "SOC 2-compliant processes across every service line—protecting your data, workflows, and customer experience."),
        securityCard("KeyRound", "Role-Based Access Controls", "Role-based access controls ensure your systems stay secure, with every Office Beacon team member trained on your protocols."),
        securityCard("Lock", "Enterprise-Grade Security", "Enterprise-grade infrastructure with 24/7 monitoring, encrypted communications, and zero tolerance for data leaks."),
      ], 3, merge({ layout: { gridTemplateColumns: "repeat(3, 1fr)" }, spacing: { gap: 32 } }), "ob-grid-cols-3"),
    ])]
  )
);

/* 15. Launch Your Remote Team (5 steps + CTA image card) */
const stepCard = (n, title, text) =>
  col([
    div([heading(n, 4, type({ fontSize: 28, fontWeight: 700, color: WHITE, textAlign: "center" }))],
      merge(bg(BLUE), { sizing: { width: 56, height: 56 }, layout: { display: "flex", justifyContent: "center", alignItems: "center" }, borders: { borderRadius: 999 } })),
    heading(title, 4, merge(type({ fontSize: 20, fontWeight: 700, color: NAVY }), { spacing: { marginTop: 12, marginBottom: 8 } })),
    para(text, type({ fontSize: 16, color: GREY })),
  ], 1, flexCol("flex-start", 6));

const stepCtaCard = col([
  div([
    btn("See How It Works", "/how-it-works", { partStyles: { backgroundColor: WHITE, color: NAVY } }),
  ], merge(
    { colors: { backgroundImage: "url(https://www.officebeacon.com/hubfs/website/images/Office-Beacon-General/Office-Beacon-General_16-9/Office-Beacon-General_16-9_04.jpg)" } },
    { layout: { display: "flex", justifyContent: "center", alignItems: "flex-end" }, spacing: { paddingTop: 120, paddingBottom: 24, paddingLeft: 24, paddingRight: 24 }, borders: { borderRadius: 12 }, sizing: { minHeight: 220 } })),
], 1);

sections.push(
  section(merge(bg("#f0f7ff"), pad(64, 24)),
    [container([
      heading("Launch Your Remote Team in Days, Not Weeks", 2,
        merge(type({ fontSize: 36, fontWeight: 700, color: NAVY }), { spacing: { marginBottom: 40 } })),
      grid([
        stepCard("1", "We scope and source.", "You share your job description and tools. We confirm feasibility, start sourcing, and prepare your contract."),
        stepCard("2", "We lock in your team.", "HR confirms availability. Once the paperwork is handled, we schedule your kickoff."),
        stepCard("3", "We align and assign.", "During kickoff, we verify roles, tools, and expectations—then assign your team and prep documentation."),
        stepCard("4", "We train and test.", "Your staff attend client-led training. We record sessions, draft SOPs, and prepare trackers for pre-live."),
        stepCard("5", "We launch and report.", "Your team goes live with daily reconciliation, weekly quality reports, and bi-weekly feedback baked in."),
        stepCtaCard,
      ], 3, merge({ layout: { gridTemplateColumns: "repeat(3, 1fr)" }, spacing: { gap: 32 } }), "ob-grid-cols-3 ob-steps-grid"),
    ])]
  )
);

/* 16. Ready to Scale (copy | image) — vivid brand-blue band */
sections.push(
  section(merge(bgGrad(135, [
      { color: BLUE, position: 0 },
      { color: BLUE_DARK, position: 100 },
    ]), responsivePad([80, 24, 80, 24], [64, 24, 64, 24], [48, 16, 48, 16])),
    [container([
      row([
        col([
          heading("Ready to Scale Without the Hiring Headaches?", 2,
            merge(type({ fontSize: 40, fontWeight: 700, lineHeight: 1.15, color: WHITE }), { spacing: { marginBottom: 16 } })),
          para("Join 4,000+ businesses using Office Beacon’s hybrid teams to grow faster, reduce overhead, and stay focused on what matters most.",
            merge(type({ fontSize: 20, color: "rgba(255,255,255,0.9)" }), { spacing: { marginBottom: 24 } })),
          btn("Build Your Remote Team", "https://www.officebeacon.com/lp/build-your-remote-team",
            { partStyles: { backgroundColor: WHITE, color: BLUE, padding: "16px 28px", fontWeight: 700 } }),
        ], 7, flexCol("flex-start", 8)),
        col([image("https://www.officebeacon.com/hubfs/website/images/ctas/build-your-remote-team-cta.webp",
          "build-your-remote-team-cta", { maxWidth: 520, imageStyles: { borderRadius: 12 } })], 5, flexCol("center", 0)),
      ], flexRow("space-between", "center", 40), "ob-split-row"),
    ])]
  )
);

/* 17. Latest on LinkedIn (2 cards) */
const linkedinCard = (imgUrl, dateLabel, text, url) =>
  col([
    image(imgUrl, "", { imageStyles: { borderRadius: 8 } }),
    row([icon("Linkedin", 16, "#0a66c2"), para(dateLabel, type({ fontSize: 13, color: "#9ca3af" }))],
      merge(flexRow("flex-start", "center", 8), { spacing: { gap: 8, marginTop: 12 } })),
    para(text, merge(type({ fontSize: 15, color: GREY, lineHeight: 1.6 }), { spacing: { marginTop: 8 } })),
    link("Read more", url, { color: "#0a66c2", fontSize: 15 }),
  ], 1, flexCol("flex-start", 4));

sections.push(
  section(merge(bg(WHITE), responsivePad([64, 24], [48, 20], [40, 16])),
    [container([
      heading("Latest on LinkedIn", 2,
        merge(type({ fontSize: 36, fontWeight: 700, color: NAVY }), { spacing: { marginBottom: 32 } })),
      grid([
        linkedinCard("https://www.officebeacon.com/hubfs/website/images/OpenGraph.png",
          "Mar 10, 2026",
          "Today is a reminder that behind every flag is a name, behind every name is a family, and behind the freedom that we have is a sacrifice...",
          "https://www.linkedin.com/feed/update/urn:li:share:7464721973630193664"),
        linkedinCard("https://www.officebeacon.com/hubfs/website/images/OpenGraph.png",
          "Mar 9, 2026",
          "Independence Day was never just about freedom. It was about risk. About choosing uncertainty over being limited. About believing that you...",
          "https://www.linkedin.com/company/268806"),
      ], 2, merge({ layout: { gridTemplateColumns: "repeat(2, 1fr)" }, spacing: { gap: 32 } }), "ob-grid-cols-2 ob-linkedin-grid"),
    ])]
  )
);

/* 18. Industry Articles (blog carousel → grid) */
const blogCard = (tag, tagUrl, title, url, summary, img, alt) =>
  div([
    image(img, alt, { imageStyles: { borderRadius: 8 } }),
    link(tag, tagUrl, { color: BLUE, fontSize: 13, textDecoration: "none" }),
    heading(title, 4, merge(type({ fontSize: 20, fontWeight: 700, lineHeight: 1.3, color: NAVY }), { spacing: { marginTop: 4, marginBottom: 8 } })),
    para(summary, type({ fontSize: 15, color: GREY })),
    link("Read more", url, { color: BLUE, fontSize: 15 }),
  ], flexCol("flex-start", 4));

sections.push(
  section(merge(bg(WHITE), responsivePad([64, 24], [48, 20], [40, 16])),
    [container([
      row([
        col([heading("Industry Articles", 2, type({ fontSize: 36, fontWeight: 700, color: NAVY }))], 8),
        col([btn("View More", "https://www.officebeacon.com/blog", { variant: "secondary" })], 4, flexCol("flex-end", 0)),
      ], merge(flexRow("space-between", "center", 24), { spacing: { gap: 24, marginBottom: 32 } }), "ob-articles-header"),
      slider([
        blogCard("promotional products", "https://www.officebeacon.com/blog/tag/promotional-products",
          "Don't Hurt Your Budget: A Promo Product Checklist Every Brand Needs",
          "https://www.officebeacon.com/blog/dont-hurt-your-budget-a-promo-product-checklist-every-brand-needs/",
          "Most branded merchandise budgets don't get burned through one bad decision. They leak, slowly, acros...",
          "https://www.officebeacon.com/hubfs/Dont%20Hurt%20Your%20Budget-%20A%20Promo%20Product%20Checklist%20Every%20Brand%20Needs_2.webp", ""),
        blogCard("promotional products", "https://www.officebeacon.com/blog/tag/promotional-products",
          "The ROI of a Mug: How to Measure If Your Promo Products Are Working",
          "https://www.officebeacon.com/blog/the-roi-of-a-mug-how-to-measure-if-your-promo-products-are-working",
          "Most marketing teams can pinpoint exactly how a paid ad performed last Tuesday, right down to the cl...",
          "https://www.officebeacon.com/hubfs/Imported_Blog_Media/The%20ROI%20of%20a%20Mug-%20How%20to%20Measure%20If%20Your%20Promo%20Products%20Are%20Working.jpg", "two men in a meeting"),
        blogCard("Press", "https://www.officebeacon.com/blog/tag/press",
          "Microshifting: The Flexible Work Trend Reshaping Productivity and Work-Life Balance",
          "https://www.officebeacon.com/blog/microshifting-the-flexible-work-trend-reshaping-productivity-and-work-life-balance",
          "A recent article from the Associated Press explores the rise of microshifting, a growing productivit...",
          "https://www.officebeacon.com/hubfs/Imported_Blog_Media/Microshifting-%20The%20Flexible%20Work%20Trend%20Reshaping%20Productivity%20and%20Work-Life%20Balance.webp", ""),
        blogCard("Back Office Operations", "https://www.officebeacon.com/blog/tag/back-office-operations",
          "What Happens to Your Brand When the Call Is Over?",
          "https://www.officebeacon.com/blog/what-happens-to-your-brand-when-the-call-is-over",
          "So you’ve closed another customer service call, and you might think that this is the final chapter o...",
          "https://www.officebeacon.com/hubfs/Linkedin%20Cover-%20What%20Happens%20to%20Your%20Brand%20When%20the%20Call%20Is%20Over_.jpg", "what happens to your brand when the call ends"),
        blogCard("Back Office Operations", "https://www.officebeacon.com/blog/tag/back-office-operations",
          "The Hidden Cost of After-Call Work and How AI Fixes It",
          "https://www.officebeacon.com/blog/the-hidden-cost-of-after-call-work-and-how-ai-fixes-it",
          "After-call work sounds harmless, and it is often something that feels like it’s just part of doing b...",
          "https://www.officebeacon.com/hubfs/Blog%20Cover-%20The%20Hidden%20Cost%20of%20After-Call%20Work%20and%20How%20AI%20Fixes%20It.jpg", "call center lady"),
        blogCard("Virtual Assistant Services", "https://www.officebeacon.com/blog/tag/virtual-assistant-services",
          "Extra Hands Without Extra Desks: Rethinking Sales Support",
          "https://www.officebeacon.com/blog/extra-hands-without-extra-desks-rethinking-sales-support",
          "All sales teams face familiar pressure as pipeline targets expand, buyer journeys span more channels...",
          "https://www.officebeacon.com/hubfs/Imported_Blog_Media/ExtraHandsWithoutExtraDesks.webp", ""),
      ], 3, 32, {}, "ob-articles-slider"),
    ])]
  )
);

/* 19. Footer (navy) */
const footMenu = (title, items) =>
  col([
    heading(title, 6, merge(type({ fontSize: 16, fontWeight: 700, color: YELLOW }), { spacing: { marginBottom: 12 } })),
    ...items.map(([t, u]) => link(t, u, { color: WHITE, fontSize: 14, textDecoration: "none" })),
  ], 1, flexCol("flex-start", 10));

const office = (title, lines) =>
  col([
    heading(title, 6, merge(type({ fontSize: 16, fontWeight: 700, color: YELLOW }), { spacing: { marginBottom: 8 } })),
    ...lines.map((l) => para(l, type({ fontSize: 14, color: WHITE }))),
  ], 1, flexCol("flex-start", 6));

sections.push(
  section(merge(bg(NAVY), { spacing: { paddingTop: 96, paddingBottom: 40, paddingLeft: 24, paddingRight: 24 } }),
    [container([
      /* top: logo/desc/social + offices */
      row([
        col([
          image("https://www.officebeacon.com/hubfs/website/brand/OB_Primary%20Color%20Logo_Horzontal_Wht%201.png",
            "OB_Primary Color Logo_Horzontal_Wht 1", { url: "https://www.officebeacon.com/", maxWidth: 222 }),
          para("Office Beacon is your go-to remote staffing partner for scalable business solutions.",
            merge(type({ fontSize: 14, color: WHITE }), { spacing: { marginTop: 16, marginBottom: 16 } })),
          row([
            icon("Facebook", 22, WHITE),
            icon("Linkedin", 22, WHITE),
            icon("Instagram", 22, WHITE),
          ], merge(flexRow("flex-start", "center", 16), { spacing: { gap: 16 } })),
        ], 3, flexCol("flex-start", 8)),
        col([
          row([
            office("Headquarters", ["407 N Pacific Coast Hwy, Ste 584", "Redondo Beach, CA, 90277 USA", "Phone: 1 (844) 416-4438", "Email: inquiries@officebeacon.com"]),
            office("India", ["Office Beacon ASPL", "Haribhakti Raneshwar Bhawan,", "Opposite Bank of Baroda,", "Vasna Bhayli Road Vadodara - 390007"]),
            office("South Africa", ["Johannesburg", "25 Owl Street 4th floor Metal Box Braamfontein Werf, Johannesburg, 2092 South Africa"]),
          ], flexRow("flex-start", "flex-start", 32)),
          row([
            office("Philippines", ["Office Beacon Philippines, Inc.", "First Floor Business Center 18, PhilExcel Business Park, Clark Freeport Zone, Pampanga"]),
            office("Mexico", ["Office Beacon Mexico", "Av San Jeronimo 310, San Jeronimo 64640, Monterrey, NL"]),
          ], merge(flexRow("flex-start", "flex-start", 32), { spacing: { gap: 32, marginTop: 24 } })),
        ], 9, flexCol("flex-start", 8)),
      ], flexRow("space-between", "flex-start", 32)),

      divider("rgba(255,255,255,0.1)", 1, { spacing: { marginTop: 32, marginBottom: 32 } }),

      /* menus */
      grid([
        footMenu("All Industries", [
          ["Insurance", "https://www.officebeacon.com/industries/insurance-remote-staffing/"],
          ["Promotional Products", "https://www.officebeacon.com/industries/promotional-products-remote-staffing/"],
          ["Finance & Accounting", "https://www.officebeacon.com/industries/finance-accounting-remote-staffing/"],
          ["Healthcare", "https://www.officebeacon.com/industries/healthcare-remote-staffing/"],
          ["Legal", "https://www.officebeacon.com/industries/legal-remote-staffing/"],
          ["Property Management", "https://www.officebeacon.com/industries/property-management-remote-staffing/"],
          ["Construction", "https://www.officebeacon.com/industries/construction-remote-staffing/"],
          ["View All Industries", "https://www.officebeacon.com/industries/"],
        ]),
        footMenu("Services", [
          ["Virtual Assistant", "https://www.officebeacon.com/services/virtual-assistant/"],
          ["Back Office Operations", "https://www.officebeacon.com/services/backoffice-operations-virtual-assistant/"],
          ["Administrative Support", "https://www.officebeacon.com/services/administrative-support-virtual-assistant/"],
          ["Sales Support and Lead Generation", "https://www.officebeacon.com/services/sales-support-lead-generation-virtual-assistant/"],
          ["Marketing Support", "https://www.officebeacon.com/services/marketing-support-virtual-assistant/"],
          ["Technical Support", "https://www.officebeacon.com/services/technical-support-virtual-assistant/"],
          ["View All Services", "https://www.officebeacon.com/services/"],
        ]),
        footMenu("Connect", [
          ["Contact", "https://www.officebeacon.com/contact-us/"],
          ["Careers", "https://www.officebeacon.com/careers"],
          ["Blog", "https://www.officebeacon.com/blog"],
          ["News", "https://www.officebeacon.com/press-release/"],
          ["Events", "https://events.officebeacon.com/"],
          ["FAQs", "https://www.officebeacon.com/faq/"],
          ["Become a Partner", "https://www.officebeacon.com/solutions/member-partnerships"],
        ]),
        col([
          heading("Compliance", 6, merge(type({ fontSize: 16, fontWeight: 700, color: YELLOW }), { spacing: { marginBottom: 12 } })),
          link("View All Certifications", "https://www.officebeacon.com/certification-data-protection", { color: WHITE, fontSize: 14, textDecoration: "none" }),
          para("SOC2 Type II\nISO 27001\nPCI DSS Level (III)\nGDPR\nHIPAA", merge(type({ fontSize: 14, color: WHITE, lineHeight: 2 }), { spacing: { marginTop: 12 } })),
        ], 1, flexCol("flex-start", 10)),
      ], 4, merge({ layout: { gridTemplateColumns: "repeat(4, 1fr)" }, spacing: { gap: 32 } }), "ob-grid-cols-4"),

      divider("rgba(255,255,255,0.1)", 1, { spacing: { marginTop: 32, marginBottom: 16 } }),

      /* bottom bar */
      row([
        col([para("©2026 All rights reserved.", type({ fontSize: 14, color: WHITE }))], 6),
        col([row([
          link("Terms Of Service", "https://www.officebeacon.com/terms-of-service", { color: WHITE, fontSize: 14 }),
          para("|", type({ fontSize: 14, color: WHITE })),
          link("Privacy Policy", "https://www.officebeacon.com/privacy-policy/", { color: WHITE, fontSize: 14 }),
          para("|", type({ fontSize: 14, color: WHITE })),
          link("Cookie Policy", "https://www.officebeacon.com/cookie-policy/", { color: WHITE, fontSize: 14 }),
        ], flexRow("flex-end", "center", 8))], 6),
      ], flexRow("space-between", "center", 16)),
    ], merge({ sizing: { maxWidth: 1400 } }), 1400)]
  )
);

/* =================================================================== */
/* FLATTEN to Craft node map                                           */
/* =================================================================== */
const nodes = {};
let idSeq = 0;
const nextId = () => `ob_${idSeq++}`;

function walk(n, parentId) {
  const id = nextId();
  const isCanvas = CANVAS.has(n.type);
  nodes[id] = {
    type: { resolvedName: n.type },
    isCanvas,
    props: n.props || {},
    displayName: n.type,
    custom: {},
    parent: parentId,
    hidden: n.hidden === true,
    nodes: [],
    linkedNodes: {},
  };
  for (const child of n.children || []) {
    nodes[id].nodes.push(walk(child, id));
  }
  return id;
}

/* ROOT wraps every top-level section */
nodes.ROOT = {
  type: { resolvedName: "Section" },
  isCanvas: true,
  props: { styles: { typography: { fontFamily: FONT } } },
  displayName: "Section",
  custom: {},
  parent: null,
  hidden: false,
  nodes: [],
  linkedNodes: {},
};
for (const s of sections) nodes.ROOT.nodes.push(walk(s, "ROOT"));

const out = { schemaVersion: "2.0", root: "ROOT", nodes };
const json = JSON.stringify(out, null, 2);

writeFileSync(join(ROOT_DIR, "apps/admin/src/views/builder/sections/obHomepage.json"), json);
writeFileSync(join(ROOT_DIR, "officebeacon-homepage.json"), json);

console.log(`Wrote ${Object.keys(nodes).length} nodes across ${sections.length} top-level sections.`);
