/**
 * Generates a Craft.js SerializedLayout mirroring officebeacon.com/how-it-works.
 * Every element is an editable builder block — no hardcoded React page.
 *
 * Run:  bun scripts/build-ob-how-it-works.mjs
 * Writes: apps/admin/src/views/builder/sections/obHowItWorks.json
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { OB_NAV_ITEMS } from "../packages/blocks/src/ob-nav-data.ts";

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

const NAVY = "#002244";
const BLUE = "#147eff";
const BLUE_DARK = "#0a5cd8";
const GREY = "#6c7c93";
const YELLOW = "#ffb612";
const WHITE = "#ffffff";
const FONT = "Poppins, 'Segoe UI', system-ui, sans-serif";


const bgGrad = (angle, stops) => ({ colors: { backgroundGradient: { type: "linear", angle, stops } } });
const CANVAS = new Set(["Section", "Container", "Row", "Column", "Grid", "Slider", "Div", "Card"]);
const node = (type, props = {}, children = []) => ({ type, props, children });
const section = (styles, children, className) => node("Section", { styles, ...(className ? { className } : {}) }, children);
const container = (children, styles = {}, maxWidth = 1280, className) =>
  node("Container", { maxWidth, styles: { sizing: { maxWidth }, ...styles }, ...(className ? { className } : {}) }, children);
const row = (children, styles = {}, className) => node("Row", { styles, ...(className ? { className } : {}) }, children);
const col = (children, flex, styles = {}, className) => node("Column", { flex, styles, ...(className ? { className } : {}) }, children);
const grid = (children, columns = 3, styles = {}, className) =>
  node("Grid", { columns, styles, ...(className ? { className } : {}) }, children);
const div = (children, styles = {}, className) => node("Div", { styles, ...(className ? { className } : {}) }, children);
const slider = (children, slidesVisible = 3, gap = 32, styles = {}, className) =>
  node("Slider", { slidesVisible, gap, showArrows: true, autoplay: true, autoplayInterval: 5000, styles, ...(className ? { className } : {}) }, children);
const heading = (text, level, styles = {}, extra = {}) => node("Heading", { text, level, styles, ...extra }, []);
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
const card = (children, styles = {}, className) => node("Card", { styles, ...(className ? { className } : {}) }, children);

const pad = (t, r, b, l) => ({ spacing: { paddingTop: t, paddingRight: r ?? t, paddingBottom: b ?? t, paddingLeft: l ?? r ?? t } });
const responsivePad = (desktop, tablet, mobile) => ({
  spacing: {
    paddingTop: desktop[0], paddingRight: desktop[1] ?? desktop[0],
    paddingBottom: desktop[2] ?? desktop[0], paddingLeft: desktop[3] ?? desktop[1] ?? desktop[0],
  },
  responsive: {
    tablet: { spacing: { paddingTop: tablet[0], paddingRight: tablet[1] ?? tablet[0], paddingBottom: tablet[2] ?? tablet[0], paddingLeft: tablet[3] ?? tablet[1] ?? tablet[0] } },
    mobile: { spacing: { paddingTop: mobile[0], paddingRight: mobile[1] ?? mobile[0], paddingBottom: mobile[2] ?? mobile[0], paddingLeft: mobile[3] ?? mobile[1] ?? mobile[0] } },
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

const sections = [];

/* Topbar */
sections.push(section(merge(bg(BLUE), pad(8, 24)), [container([row([link("Log In", "https://app.officebeacon.com/ecommpay/cregistration1.aspx", { color: WHITE, fontSize: 14, textDecoration: "none" })], flexRow("flex-end", "center", 20))])]));

/* Navbar */
sections.push(node("Navbar", {
  logoImage: "https://www.officebeacon.com/hs-fs/hubfs/office-beacon/logos/OB%20Logo%20Colour.png?width=175&height=38&name=OB%20Logo%20Colour.png",
  logoUrl: "/ob-homepage",
  logoText: "Office Beacon",
  logoImageHeight: 38,
  sticky: true,
  navItems: OB_NAV_ITEMS,
  linkStyles: { color: GREY, fontSize: 16 },
  ctaText: "Get Started",
  ctaUrl: "https://www.officebeacon.com/lp/build-your-remote-team",
  showCta: true,
  ctaStyles: { background: "linear-gradient(90deg, #147eff, #4d9dff)", color: WHITE, paddingX: 20, paddingY: 10, borderRadius: 8 },
  styles: merge(bg(WHITE), pad(12, 24), { shadows: { boxShadow: "0px 1px 0px 0px rgba(108,124,147,0.1)" } }),
}, []));

/* Hero */
sections.push(section(merge(
  bgGrad(180, [{ color: "#e5f2ff", position: 0 }, { color: "#ffffff", position: 100 }]),
  responsivePad([48, 24, 48, 24], [40, 24, 32, 24], [40, 16, 20, 16]),
), [container([
  heading("Remote Staffing That's Structured, Secure, and Built to Scale.", 1,
    merge(type({ fontSize: 48, fontWeight: 700, lineHeight: 1.15, color: NAVY, textAlign: "center" }), { spacing: { marginBottom: 16 } }),
    { highlightText: "Structured, Secure, and Built to Scale.", highlightColor: BLUE }),
  para("We recruit, train, and manage your remote team within our infrastructure. You get reliable support without all the hiring headaches.",
    merge(type({ fontSize: 20, color: GREY, textAlign: "center" }), { spacing: { marginBottom: 24 } })),
  div([btn("Build Your Remote Team", "https://www.officebeacon.com/lp/build-your-remote-team", { iconAfter: "→", partStyles: { padding: "16px 28px" } })],
    merge(flexRow("center", "center"), { layout: { display: "flex" } })),
], merge({ sizing: { maxWidth: 900 } }), 900)]));

/* How We Build Remote Teams */
const buildListItem = (title, text) =>
  para(`${title} — ${text}`, merge(type({ fontSize: 16, color: GREY, lineHeight: 1.6 }), { spacing: { marginBottom: 12 } }));

sections.push(section(merge(bg(WHITE), responsivePad([32, 24, 32, 24], [32, 24, 32, 24], [20, 16, 20, 16])), [container([
  row([
    col([heading("How We Build Remote Teams That Actually Work.", 2,
      merge(type({ fontSize: 36, fontWeight: 700, lineHeight: 1.2, color: NAVY }), { spacing: { marginBottom: 0 } }))], 4, merge(flexCol("flex-start", 8), pad(0, 48, 0, 0))),
    col([card([
      buildListItem("Recruit & Train", "We source professionals and train them on your tools, workflows, and expectations."),
      buildListItem("Secure Infrastructure", "Your team operates within Office Beacon's facilities with enterprise-grade tech and compliance baked in."),
      buildListItem("Seamless Integration", "We plug into your systems—Slack, CRM, SOPs—so your team feels in-house from day one."),
      buildListItem("Ongoing Oversight", "Dedicated managers, SLAs, and performance metrics keep your team accountable and on track."),
      buildListItem("Specialized Expertise", "Need finance, legal, or healthcare support? We've got trained talent ready to deploy."),
    ], merge(
      { borders: { borderLeftWidth: 3, borderLeftColor: BLUE, borderRadius: 0 }, spacing: { paddingTop: 24, paddingRight: 24, paddingBottom: 24, paddingLeft: 24 } },
      bg(WHITE),
    ))], 8, flexCol("flex-start", 0)),
  ], flexRow("space-between", "flex-start", 40), "ob-split-row"),
])]));

/* Everything You Need + icon list */
const iconListItem = (text) =>
  row([icon("ChevronRight", 18, BLUE), para(text, type({ fontSize: 16, color: NAVY }))], merge(flexRow("flex-start", "flex-start", 12, "nowrap"), { spacing: { gap: 12, marginBottom: 12 } }), "ob-keep-row");

sections.push(section(merge(bg(WHITE), responsivePad([32, 24, 32, 24], [32, 24, 32, 24], [20, 16, 20, 16])), [container([
  row([
    col([image("https://www.officebeacon.com/hs-fs/hubfs/website/images/Office-Beacon-General/Office-Beacon-General_4-3/Office-Beacon-General_4-3_01.jpg?width=606&height=455&name=Office-Beacon-General_4-3_01.jpg",
      "Remote Team Management", { maxWidth: 606, imageStyles: { borderRadius: 12 } })], 6, flexCol("center", 8)),
    col([
      heading("Everything You Need to Run a Remote Team That Works", 2,
        merge(type({ fontSize: 36, fontWeight: 700, lineHeight: 1.2, color: NAVY }), { spacing: { marginBottom: 16 } }),
        { highlightText: "That Works", highlightColor: BLUE }),
      para("Office Beacon doesn't hand off talent and hope for the best. We build the team, set up the infrastructure, and manage performance. You focus on growth, we'll handle the logistics.",
        merge(type({ fontSize: 18, color: GREY, lineHeight: 1.6 }), { spacing: { marginBottom: 20 } })),
      iconListItem("Training built into every engagement"),
      iconListItem("Secure infrastructure and tech setup"),
      iconListItem("Dedicated oversight with SLAs and performance tracking"),
      iconListItem("Access to specialized roles across departments"),
    ], 6, flexCol("flex-start", 8)),
  ], flexRow("space-between", "center", 40), "ob-split-row"),
])]));

/* Testimonials */
const videoCard = (poster, mp4, title, sub) =>
  div([
    div([video(mp4, poster)], { borders: { borderRadius: 12 }, effects: {} }),
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
  "We partnered with Office Beacon hoping to fill a need on our sales team. What we found was so much more. Our South Africa-based virtual team member, Alta, has become a genuine part of our culture at My Brand. She participates fully in everything we do — not as a remote resource, but as a real teammate. That became clear in the most unexpected and moving way. When My Brand launched our annual charity drive last December, Alta wanted to participate. Currency exchange made direct donation difficult — so we suggested choosing a local charity to support. She did far more than that. Alta reached out to Office Beacon and initiated a charity drive for Gift a Child Children's Home. The cause was personal: On her son's first birthday, she took her kids to donate to children's homes in gratitude — and one home, despite having very little, left an indelible mark on her heart. When given the chance to choose a charity for this initiative, she chose them immediately. What began as one person's desire to participate became a fully coordinated, cross-office initiative spanning two continents with the Office Beacon team and the My Brand team supporting this heartfelt and important initiative. This is what remote staffing looks like when it's done right — not transactional, but fully integrated, values-aligned, and deeply human. We couldn't be prouder to be part of this story.";

sections.push(section(merge(bg(WHITE), pad(40, 24)), [container([
  heading("What they say about Office Beacon", 2,
    merge(type({ fontSize: 36, fontWeight: 700, color: NAVY, textAlign: "center" }), { spacing: { marginBottom: 32 } }),
    { highlightText: "Office Beacon", highlightColor: BLUE }),
  slider([
    videoCard("https://www.officebeacon.com/hubfs/Client%20Testimonials/Dave%20Williams%20Thumbnail%20With%20Text.png",
      "https://23629617.fs1.hubspotusercontent-na1.net/hubfs/23629617/Client%20Testimonials/Dave%20Williams.mp4",
      "Dave Williams", "Farmer's Insurance Agency Owner"),
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
])]));

/* Timeline — 30 days */
const stepCard = (numIcon, eyebrow, title, text) =>
  card([
    image(numIcon, "", { maxWidth: 56, width: 56 }),
    para(eyebrow, merge(type({ fontSize: 14, fontWeight: 700, color: BLUE }), { spacing: { marginTop: 16, marginBottom: 8 } })),
    heading(title, 5, merge(type({ fontSize: 22, fontWeight: 700, color: NAVY }), { spacing: { marginBottom: 8 } })),
    para(text, type({ fontSize: 16, color: GREY, lineHeight: 1.6 })),
  ], merge(bg(WHITE), pad(24, 24), { borders: { borderRadius: 0 } }));

const ICON_BASE = "https://www.officebeacon.com/hubfs/website/assets";

sections.push(section(merge(bg(WHITE), responsivePad([40, 24, 40, 24], [32, 24, 32, 24], [20, 16, 20, 16])), [container([
  row([
    col([heading("From Discovery to Go-Live—in Under 30 Days.", 2,
      merge(type({ fontSize: 36, fontWeight: 700, lineHeight: 1.2, color: NAVY }), { spacing: { marginBottom: 0 } }))], 4, flexCol("flex-start", 8)),
    col([grid([
      stepCard(`${ICON_BASE}/icon-number-1.svg`, "Day 1-2", "Discovery & Sourcing", "We review your job descriptions, tools, and workflow - then stat sourcing talent."),
      stepCard(`${ICON_BASE}/icon-number-2.svg`, "Day 3-7", "Confirmation & Contract", "We confirm availability, finalize the contract, and prep your onboarding plan."),
      stepCard(`${ICON_BASE}/icon-number-3.svg`, "Day 8-11", "Kickoff & Meet Your Team", "We verify roles, assign your Team Leader, and introduce your staff."),
      stepCard(`${ICON_BASE}/icon-number-4.svg`, "Day 12-30", "Training & Go-Live", "Your team trains, enters pre-live, and launches with trackers, SOPs, and feedback baked in."),
    ], 2, merge({ layout: { gridTemplateColumns: "repeat(2, 1fr)" }, spacing: { gap: 32 } }), "ob-grid-cols-2 ob-steps-grid")], 8, flexCol("flex-start", 0)),
  ], flexRow("space-between", "flex-start", 40), "ob-split-row"),
])]));

/* Stats band */
const counter = (num, suffix, title, desc) =>
  col([
    row([
      heading(num, 2, type({ fontSize: 64, fontWeight: 700, color: WHITE, lineHeight: 1 }), { countUp: true, countUpDuration: 2000 }),
      heading(suffix, 3, type({ fontSize: 28, fontWeight: 700, color: WHITE })),
    ], merge(flexRow("center", "baseline", 4, "nowrap"), { spacing: { gap: 4 } }), "ob-stat-value-row"),
    heading(title, 4, merge(type({ fontSize: 30, fontWeight: 700, color: WHITE, textAlign: "center" }), { spacing: { marginTop: 8, marginBottom: 8 } })),
    para(desc, type({ fontSize: 16, color: WHITE, textAlign: "center" })),
  ], 1, merge(flexCol("center", 4), pad(32, 28)), "ob-stat-card cms-auto-col");

sections.push(section(merge(
  bgGrad(90, [{ color: BLUE, position: 0 }, { color: "#4d9dff", position: 100 }]),
  responsivePad([40, 24, 40, 24], [40, 24, 40, 24], [40, 16, 40, 16]),
), [container([
  grid([
    counter("40", "%", "Average Cost Savings", "Clients reduce overhead and scale faster by replacing traditional hiring with hybrid teams that deliver more for less."),
    counter("24", "/7", "Global Coverage", "Our remote teams operate across time zones, ensuring round-the-clock support without burnout or bottlenecks."),
    counter("4,000", "+", "Businesses Served", "From startups to enterprises, thousands trust Office Beacon to support growth, protect margins, and deliver results."),
  ], 3, merge({ layout: { gridTemplateColumns: "repeat(3, 1fr)" }, spacing: { gap: 32 } }), "ob-grid-cols-3 ob-stats-grid"),
])]));

/* Office Beacon Works */
sections.push(section(merge(bg(WHITE), responsivePad([32, 24, 32, 24], [32, 24, 32, 24], [20, 16, 20, 16])), [container([
  row([
    col([
      heading("Office Beacon Works When Traditional Staffing Doesn't.", 2,
        merge(type({ fontSize: 36, fontWeight: 700, lineHeight: 1.2, color: NAVY }), { spacing: { marginBottom: 16 } }),
        { highlightText: "Office Beacon Works", highlightColor: BLUE }),
      para("Traditional staffing puts the burden on you—recruiting, training, oversight, and infrastructure. Office Beacon handles the logistics end-to-end. You get trained talent, secure facilities, built-in management, and SLA-backed accountability from day one.",
        type({ fontSize: 18, color: GREY, lineHeight: 1.6 })),
    ], 6, flexCol("flex-start", 8)),
    col([image("https://www.officebeacon.com/hs-fs/hubfs/website/images/Office-Beacon-General/Office-Beacon-General_4-3/Office-Beacon-General_4-3_22.jpg?width=606&height=455&name=Office-Beacon-General_4-3_22.jpg",
      "Outsource Remote Staffing Services", { maxWidth: 606, imageStyles: { borderRadius: 12 } })], 6, flexCol("center", 8)),
  ], flexRow("space-between", "center", 40), "ob-split-row"),
])]));

/* Bottom CTA */
sections.push(section(merge(
  bgGrad(180, [{ color: "#ffffff", position: 0 }, { color: "#e5f2ff", position: 100 }]),
  responsivePad([32, 24, 64, 24], [32, 24, 48, 24], [20, 16, 40, 16]),
), [container([
  card([
    heading("Build Your Team. Skip the Hiring Headaches.", 2,
      merge(type({ fontSize: 32, fontWeight: 700, color: NAVY, textAlign: "center" }), { spacing: { marginBottom: 24 } })),
    div([btn("Build Your Remote Team", "https://www.officebeacon.com/lp/build-your-remote-team", { partStyles: { padding: "14px 28px" } })],
      merge(flexRow("center", "center"), { layout: { display: "flex" } })),
  ], merge(
    bgGrad(180, [{ color: "#ffffff", position: 0 }, { color: "#f3f4f6", position: 100 }]),
    pad(40, 40),
    { borders: { borderRadius: 12 }, effects: { boxShadow: "0 4px 24px rgba(0,34,68,0.08)" } },
  )),
], merge({ sizing: { maxWidth: 960 } }), 960)]));

/* Footer (same structure as homepage) */
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

sections.push(section(merge(bg(NAVY), { spacing: { paddingTop: 96, paddingBottom: 40, paddingLeft: 24, paddingRight: 24 } }), [container([
  row([
    col([
      image("https://www.officebeacon.com/hubfs/website/brand/OB_Primary%20Color%20Logo_Horzontal_Wht%201.png",
        "OB_Primary Color Logo_Horzontal_Wht 1", { url: "/", maxWidth: 222 }),
      para("Office Beacon is your go-to remote staffing partner for scalable business solutions.",
        merge(type({ fontSize: 14, color: WHITE }), { spacing: { marginTop: 16, marginBottom: 16 } })),
      row([icon("Facebook", 22, WHITE), icon("Linkedin", 22, WHITE), icon("Instagram", 22, WHITE)],
        merge(flexRow("flex-start", "center", 16), { spacing: { gap: 16 } })),
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
], merge({ sizing: { maxWidth: 1400 } }), 1400)]));

/* Flatten */
const nodes = {};
let idSeq = 0;
const nextId = () => `hiw_${idSeq++}`;

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
  for (const child of n.children || []) nodes[id].nodes.push(walk(child, id));
  return id;
}

nodes.ROOT = {
  type: { resolvedName: "Section" },
  isCanvas: true,
  props: {
    styles: { typography: { fontFamily: FONT } },
    seo: {
      title: "How OfficeBeacon Remote Staffing & Virtual Assistant Works",
      description: "Discover how virtual assistant & remote staffing services work. From hiring to scaling, Office Beacon makes outsourcing easy—contact us today!",
    },
  },
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
const outPath = join(ROOT_DIR, "apps/admin/src/views/builder/sections/obHowItWorks.json");
writeFileSync(outPath, json);
console.log(`Wrote ${Object.keys(nodes).length} nodes to ${outPath}`);
