/**
 * Compact Craft layouts for builtin Starter Template seeds.
 * Uses registered block types only — same shape as API create after normalize.
 */

type SeedNode = {
  type: string;
  props?: Record<string, unknown>;
  nodes?: SeedNode[];
  isCanvas?: boolean;
};

const CANVAS = new Set([
  "Section",
  "Container",
  "Row",
  "Column",
  "Grid",
  "Div",
]);

const T = {
  primary: "hsl(var(--primary))",
  primaryFg: "hsl(var(--primary-foreground))",
  fg: "hsl(var(--foreground))",
  bg: "hsl(var(--background))",
  muted: "hsl(var(--muted))",
  mutedFg: "hsl(var(--muted-foreground))",
  card: "hsl(var(--card))",
  border: "hsl(var(--border))",
} as const;

const PLACEHOLDER_IMG =
  "https://placehold.co/640x420/e2e8f0/64748b?text=Image";
const PLACEHOLDER_AVATAR =
  "https://placehold.co/96x96/e2e8f0/64748b?text=%20";
const n = (
  type: string,
  props: Record<string, unknown> = {},
  nodes: SeedNode[] = [],
): SeedNode => ({
  type,
  props,
  nodes,
  isCanvas: CANVAS.has(type),
});

const sectionPad = (bg: string, py = 80): Record<string, unknown> => ({
  styles: {
    spacing: {
      paddingTop: py,
      paddingBottom: py,
      paddingLeft: 24,
      paddingRight: 24,
    },
    colors: { backgroundColor: bg },
  },
});

const container = (maxWidth: number, children: SeedNode[]): SeedNode =>
  n(
    "Container",
    {
      maxWidth,
      styles: {
        sizing: { maxWidth },
        spacing: { marginLeft: "auto", marginRight: "auto" },
      },
    },
    children,
  );

/** Flatten nested authoring tree into a Craft SerializedLayout-shaped object. */
export function buildPageLayout(topLevel: SeedNode[]): Record<string, unknown> {
  const nodes: Record<string, unknown> = {};
  let seq = 0;
  const nextId = (): string => `seed_${++seq}`;

  const walk = (node: SeedNode, parent: string | null): string => {
    const id = parent === null ? "ROOT" : nextId();
    const childIds = (node.nodes ?? []).map((child) => walk(child, id));
    nodes[id] = {
      type: { resolvedName: node.type },
      isCanvas: node.isCanvas ?? CANVAS.has(node.type),
      props: node.props ?? {},
      displayName: node.type,
      custom: {},
      parent,
      hidden: false,
      nodes: childIds,
      linkedNodes: {},
    };
    return id;
  };

  walk(
    {
      type: "Section",
      isCanvas: true,
      props: {},
      nodes: topLevel,
    },
    null,
  );

  return { schemaVersion: "2.0", root: "ROOT", nodes };
}

const hero = (
  title: string,
  subtitle: string,
  cta = "Get started",
  layout: "centered" | "split" = "centered",
  imageUrl?: string,
): SeedNode =>
  n("Section", sectionPad(T.bg, 96), [
    n("Hero Section", {
      layout,
      title,
      subtitle,
      showCta: true,
      ...(imageUrl ? { imageUrl } : {}),
      buttons: [
        {
          label: cta,
          url: "#",
          styles: { backgroundColor: T.primary, color: T.primaryFg },
        },
      ],
    }),
  ]);

const features = (
  title: string,
  items: { title: string; description: string; icon: string }[],
): SeedNode =>
  n("Section", sectionPad(T.bg), [
    container(1100, [
      n("Section Heading", {
        subtitle: "FEATURES",
        title,
        align: "center",
        styles: { spacing: { marginBottom: 40 } },
      }),
      n("Feature List", { columns: Math.min(items.length, 3), features: items }),
    ]),
  ]);

const ctaBand = (title: string, subtitle: string, label = "Contact us"): SeedNode =>
  n("Section", sectionPad(T.muted, 72), [
    container(720, [
      n("Heading", {
        text: title,
        level: 2,
        styles: {
          typography: { fontSize: 32, fontWeight: 700, textAlign: "center" },
          colors: { textColor: T.fg },
        },
      }),
      n("Paragraph", {
        text: subtitle,
        styles: {
          typography: { textAlign: "center", fontSize: 16 },
          colors: { textColor: T.mutedFg },
          spacing: { marginTop: 12, marginBottom: 24 },
        },
      }),
      n("Button", {
        label,
        url: "#",
        styles: {
          colors: { backgroundColor: T.primary, textColor: T.primaryFg },
          spacing: { marginLeft: "auto", marginRight: "auto" },
        },
      }),
    ]),
  ]);

const prose = (title: string, body: string): SeedNode =>
  n("Section", sectionPad(T.bg, 64), [
    container(760, [
      n("Heading", {
        text: title,
        level: 1,
        styles: {
          typography: { fontSize: 36, fontWeight: 700 },
          colors: { textColor: T.fg },
        },
      }),
      n("Paragraph", {
        text: body,
        styles: {
          typography: { fontSize: 16 },
          colors: { textColor: T.mutedFg },
          spacing: { marginTop: 16 },
        },
      }),
    ]),
  ]);

const logoCloud = (): SeedNode =>
  n("Section", sectionPad(T.bg, 56), [
    container(1100, [
      n("Section Heading", {
        subtitle: "TRUSTED BY",
        title: "Teams who ship with us",
        align: "center",
        styles: { spacing: { marginBottom: 28 } },
      }),
      n("Logo Carousel", {
        marquee: true,
        logos: ["Acme", "Northwind", "Globex", "Initech", "Umbrella"],
      }),
    ]),
  ]);

const statsBand = (): SeedNode =>
  n("Section", sectionPad(T.muted, 64), [
    container(1100, [
      n("Section Heading", {
        subtitle: "BY THE NUMBERS",
        title: "Built for scale",
        align: "center",
        styles: { spacing: { marginBottom: 32 } },
      }),
      n("Counter Section", {
        columns: 4,
        animate: true,
        cardStyle: true,
        stats: [
          { value: "500+", label: "Sites launched", description: "Across tenants." },
          { value: "98%", label: "On-brand", description: "Theme tokens applied." },
          { value: "5min", label: "Avg. build", description: "Blank to draft." },
          { value: "24/7", label: "Available", description: "Always online." },
        ],
      }),
    ]),
  ]);

const testimonialQuote = (): SeedNode =>
  n("Section", sectionPad(T.card, 72), [
    container(760, [
      n("Paragraph", {
        text: "“We replaced weeks of design handoff with starter templates our marketers can edit themselves.”",
        styles: {
          typography: { fontSize: 24, textAlign: "center", lineHeight: 1.5, fontWeight: 500 },
          colors: { textColor: T.fg },
        },
      }),
      n("Image", {
        imageUrl: PLACEHOLDER_AVATAR,
        altText: "Customer",
        width: 64,
        height: 64,
        imageStyles: { borderRadius: 999 },
        styles: { spacing: { marginTop: 24, marginLeft: "auto", marginRight: "auto" } },
      }),
      n("Paragraph", {
        text: "Jordan Lee · Head of Marketing",
        styles: {
          typography: { textAlign: "center", fontSize: 14 },
          colors: { textColor: T.mutedFg },
          spacing: { marginTop: 12 },
        },
      }),
    ]),
  ]);

const pricingBand = (): SeedNode =>
  n("Section", sectionPad(T.bg), [
    container(1100, [
      n("Section Heading", {
        subtitle: "PRICING",
        title: "Simple, transparent plans",
        align: "center",
        styles: { spacing: { marginBottom: 40 } },
      }),
      n("Pricing Table", {
        plans: [
          {
            name: "Starter",
            price: "$0",
            period: "/mo",
            featuresText: "1 site | 5 pages | Community support",
            ctaLabel: "Get started",
            ctaUrl: "#",
          },
          {
            name: "Pro",
            price: "$29",
            period: "/mo",
            featuresText: "Unlimited pages | Brand theming | Priority support",
            ctaLabel: "Start trial",
            ctaUrl: "#",
            featured: true,
          },
          {
            name: "Enterprise",
            price: "Custom",
            period: "",
            featuresText: "SSO & roles | Dedicated support | Custom SLAs",
            ctaLabel: "Contact sales",
            ctaUrl: "#",
          },
        ],
      }),
    ]),
  ]);

const faqBand = (): SeedNode =>
  n("Section", sectionPad(T.muted, 64), [
    container(800, [
      n("Section Heading", {
        subtitle: "FAQ",
        title: "Common questions",
        align: "center",
        styles: { spacing: { marginBottom: 32 } },
      }),
      n("Accordion", {
        items: [
          {
            title: "Can I edit every section?",
            content: "Yes — each block opens in the builder and uses your site theme tokens.",
          },
          {
            title: "Do starters create a new page?",
            content: "Using a Starter Template creates a draft page you can publish when ready.",
          },
          {
            title: "Can I remove sections I do not need?",
            content: "Delete or replace any band — starters are starting points, not locked layouts.",
          },
        ],
      }),
    ]),
  ]);

const teamBand = (): SeedNode =>
  n("Section", sectionPad(T.bg), [
    container(1100, [
      n("Section Heading", {
        subtitle: "OUR TEAM",
        title: "Meet the people behind the brand",
        align: "center",
        styles: { spacing: { marginBottom: 40 } },
      }),
      n("Team Grid", {
        columns: 4,
        members: [
          { name: "Avery Stone", role: "CEO", photo: PLACEHOLDER_AVATAR },
          { name: "Riley Chen", role: "Head of Design", photo: PLACEHOLDER_AVATAR },
          { name: "Morgan Diaz", role: "Engineering Lead", photo: PLACEHOLDER_AVATAR },
          { name: "Casey Park", role: "Customer Success", photo: PLACEHOLDER_AVATAR },
        ],
      }),
    ]),
  ]);

const galleryBand = (): SeedNode =>
  n("Section", sectionPad(T.bg), [
    container(1100, [
      n("Section Heading", {
        subtitle: "SELECTED WORK",
        title: "Featured projects",
        align: "center",
        styles: { spacing: { marginBottom: 32 } },
      }),
      n("Gallery", {
        columns: 3,
        lightbox: true,
        images: [
          { imageUrl: PLACEHOLDER_IMG, caption: "Project Alpha" },
          { imageUrl: PLACEHOLDER_IMG, caption: "Project Beta" },
          { imageUrl: PLACEHOLDER_IMG, caption: "Project Gamma" },
          { imageUrl: PLACEHOLDER_IMG, caption: "Project Delta" },
          { imageUrl: PLACEHOLDER_IMG, caption: "Project Epsilon" },
          { imageUrl: PLACEHOLDER_IMG, caption: "Project Zeta" },
        ],
      }),
    ]),
  ]);

const leadGenHero = (title: string, subtitle: string): SeedNode =>
  n("Section", sectionPad(T.muted, 88), [
    container(720, [
      n("Heading", {
        text: title,
        level: 1,
        styles: {
          typography: { fontSize: 44, fontWeight: 700, textAlign: "center" },
          colors: { textColor: T.fg },
        },
      }),
      n("Paragraph", {
        text: subtitle,
        styles: {
          typography: { textAlign: "center", fontSize: 18 },
          colors: { textColor: T.mutedFg },
          spacing: { marginTop: 16, marginBottom: 24 },
        },
      }),
      n("Form", { submitLabel: "Claim offer" }),
    ]),
  ]);

type CardGridItem = { title: string; description: string; imageUrl?: string };

const cardGridBand = (
  subtitle: string,
  title: string,
  cards: CardGridItem[],
  columns = 3,
): SeedNode =>
  n("Section", sectionPad(T.bg), [
    container(1100, [
      n("Section Heading", {
        subtitle,
        title,
        align: "center",
        styles: { spacing: { marginBottom: 40 } },
      }),
      n(
        "Grid",
        {
          columns,
          styles: {
            layout: {
              display: "grid",
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: 24,
            },
          },
        },
        cards.map((card) =>
          n("Column", {}, [
            ...(card.imageUrl
              ? [
                  n("Image", {
                    imageUrl: card.imageUrl,
                    altText: card.title,
                    imageStyles: { borderRadius: 8 },
                  }),
                ]
              : []),
            n("Heading", {
              text: card.title,
              level: 3,
              styles: {
                typography: { fontSize: 20, fontWeight: 600 },
                colors: { textColor: T.fg },
                spacing: { marginTop: card.imageUrl ? 16 : 0 },
              },
            }),
            n("Paragraph", {
              text: card.description,
              styles: {
                colors: { textColor: T.mutedFg },
                spacing: { marginTop: 8 },
              },
            }),
          ]),
        ),
      ),
    ]),
  ]);

const blogGridBand = (): SeedNode =>
  n("Section", sectionPad(T.bg), [
    container(1100, [
      n("Section Heading", {
        subtitle: "BLOG",
        title: "Latest articles",
        align: "center",
        styles: { spacing: { marginBottom: 40 } },
      }),
      n("Article Card Grid", {
        columns: 3,
        layout: "grid",
        showArrows: false,
        articles: [
          {
            imageUrl: PLACEHOLDER_IMG,
            title: "How we rebuilt our editor",
            summary: "A look behind the scenes at our new visual builder.",
            url: "#",
            readMoreText: "Read more",
          },
          {
            imageUrl: PLACEHOLDER_IMG,
            title: "Design systems 101",
            summary: "Everything you need to start a scalable design system.",
            url: "#",
            readMoreText: "Read more",
          },
          {
            imageUrl: PLACEHOLDER_IMG,
            title: "Our journey to 4,000 customers",
            summary: "The lessons we learned scaling from zero.",
            url: "#",
            readMoreText: "Read more",
          },
        ],
      }),
    ]),
  ]);

const DEFAULT_SERVICE_CARDS: CardGridItem[] = [
  {
    title: "Strategy & consulting",
    description: "Align stakeholders on goals, messaging, and a roadmap you can execute.",
    imageUrl: PLACEHOLDER_IMG,
  },
  {
    title: "Design & build",
    description: "Ship on-brand pages with reusable sections your team can edit.",
    imageUrl: PLACEHOLDER_IMG,
  },
  {
    title: "Launch & optimize",
    description: "Publish confidently, then iterate with analytics and experiments.",
    imageUrl: PLACEHOLDER_IMG,
  },
];

/** Per-template page layouts keyed by templateKey. */
export const STARTER_LAYOUT_BUILDERS: Record<
  string,
  () => Record<string, unknown>
> = {
  "tpl-blank": () =>
    buildPageLayout([
      n("Section", sectionPad(T.bg, 64), [
        container(760, [
          n("Heading", {
            text: "Blank page",
            level: 1,
            styles: {
              typography: { fontSize: 32, fontWeight: 700 },
              colors: { textColor: T.fg },
            },
          }),
          n("Paragraph", {
            text: "Start from a clean canvas. Add sections from the library or drop in My Templates.",
            styles: {
              colors: { textColor: T.mutedFg },
              spacing: { marginTop: 12 },
            },
          }),
        ]),
      ]),
    ]),

  "tpl-saas-landing": () =>
    buildPageLayout([
      hero(
        "Ship your product site faster",
        "Campaign-ready SaaS landing with proof, pricing, and a conversion path.",
        "Start free trial",
      ),
      features("Built for growth teams", [
        {
          title: "On-brand sections",
          description: "Theme tokens keep every block aligned with your site styles.",
          icon: "🎨",
        },
        {
          title: "Editable everywhere",
          description: "Every node opens in the builder — nothing is locked behind composites.",
          icon: "🧩",
        },
        {
          title: "Ready to publish",
          description: "Replace copy and CTAs, then publish a draft when you are ready.",
          icon: "🚀",
        },
      ]),
      logoCloud(),
      testimonialQuote(),
      pricingBand(),
      ctaBand("Ready to convert visitors?", "Customize this starter and publish your landing page."),
    ]),

  "tpl-marketing-hero": () =>
    buildPageLayout([
      hero(
        "Tell your brand story",
        "Split hero with proof points — ideal for product launches and brand pages.",
        "Learn more",
        "split",
        PLACEHOLDER_IMG,
      ),
      statsBand(),
      n("Section", sectionPad(T.bg, 64), [
        container(1100, [
          n(
            "Grid",
            {
              columns: 2,
              styles: {
                layout: {
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 32,
                  alignItems: "center",
                },
              },
            },
            [
              n("Column", {}, [
                n("Heading", {
                  text: "Show the outcome",
                  level: 2,
                  styles: {
                    typography: { fontSize: 32, fontWeight: 700 },
                    colors: { textColor: T.fg },
                  },
                }),
                n("Paragraph", {
                  text: "Pair a strong visual with a concise value proposition and supporting detail.",
                  styles: {
                    colors: { textColor: T.mutedFg },
                    spacing: { marginTop: 12 },
                  },
                }),
              ]),
              n("Column", {}, [
                n("Image", {
                  imageUrl: PLACEHOLDER_IMG,
                  altText: "Product screenshot",
                  imageStyles: { borderRadius: 12 },
                }),
              ]),
            ],
          ),
        ]),
      ]),
      features("Why teams choose this layout", [
        {
          title: "Clear narrative",
          description: "Lead with a strong headline, then reinforce with three benefits.",
          icon: "📣",
        },
        {
          title: "Flexible middle",
          description: "Swap feature cards or add section presets from the library.",
          icon: "🧱",
        },
        {
          title: "Strong finish",
          description: "End with a muted CTA band that invites the next step.",
          icon: "➡️",
        },
      ]),
      ctaBand("Keep the momentum", "Add your proof points and publish."),
    ]),

  "tpl-portfolio": () =>
    buildPageLayout([
      hero(
        "Showcase your best work",
        "Portfolio starter with a project gallery, social proof, and a contact CTA.",
        "View work",
      ),
      galleryBand(),
      testimonialQuote(),
      ctaBand("Have a project in mind?", "Invite visitors to start a conversation.", "Get in touch"),
    ]),

  "tpl-contact": () =>
    buildPageLayout([
      hero(
        "Let's talk",
        "Contact page with inquiry details, a form, and quick answers.",
        "Email us",
      ),
      n("Section", sectionPad(T.bg, 64), [
        container(1100, [
          n(
            "Grid",
            {
              columns: 2,
              styles: {
                layout: {
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 40,
                },
              },
            },
            [
              n("Column", {}, [
                n("Heading", {
                  text: "Get in touch",
                  level: 2,
                  styles: {
                    typography: { fontSize: 28, fontWeight: 700 },
                    colors: { textColor: T.fg },
                  },
                }),
                n("Paragraph", {
                  text: "hello@example.com",
                  styles: { colors: { textColor: T.primary }, spacing: { marginTop: 16 } },
                }),
                n("Paragraph", {
                  text: "+1 (555) 010-2000",
                  styles: { colors: { textColor: T.mutedFg }, spacing: { marginTop: 8 } },
                }),
                n("Paragraph", {
                  text: "123 Market Street, Suite 400\nSan Francisco, CA",
                  styles: { colors: { textColor: T.mutedFg }, spacing: { marginTop: 8 } },
                }),
              ]),
              n("Column", {}, [
                n("Heading", {
                  text: "Send a message",
                  level: 2,
                  styles: {
                    typography: { fontSize: 28, fontWeight: 700 },
                    colors: { textColor: T.fg },
                  },
                }),
                n("Paragraph", {
                  text: "Connect this form to a CMS form ID, or replace it with your preferred intake flow.",
                  styles: {
                    colors: { textColor: T.mutedFg },
                    spacing: { marginTop: 12, marginBottom: 20 },
                  },
                }),
                n("Form", { submitLabel: "Submit inquiry" }),
              ]),
            ],
          ),
        ]),
      ]),
      faqBand(),
    ]),

  "tpl-about": () =>
    buildPageLayout([
      hero(
        "About our company",
        "Share your mission, team, and the proof that backs your brand.",
        "Meet the team",
      ),
      prose(
        "Who we are",
        "Replace this paragraph with your company story. The sections below give you stats, team profiles, and a closing call to action.",
      ),
      statsBand(),
      teamBand(),
      ctaBand("Want to work with us?", "Point visitors to careers or contact."),
    ]),

  "tpl-landing": () =>
    buildPageLayout([
      leadGenHero(
        "Launch your next campaign",
        "Lead-gen landing with an inline offer form, social proof, and FAQ.",
      ),
      logoCloud(),
      faqBand(),
      ctaBand("Don't miss out", "Update the offer details and go live.", "Register now"),
    ]),

  "tpl-thank-you": () =>
    buildPageLayout([
      n("Section", sectionPad(T.bg, 88), [
        container(640, [
          n("Heading", {
            text: "Thank you",
            level: 1,
            styles: {
              typography: { fontSize: 44, fontWeight: 700, textAlign: "center" },
              colors: { textColor: T.fg },
            },
          }),
          n("Paragraph", {
            text: "Your submission was received. Here is what happens next.",
            styles: {
              typography: { textAlign: "center", fontSize: 18 },
              colors: { textColor: T.mutedFg },
              spacing: { marginTop: 16, marginBottom: 28 },
            },
          }),
        ]),
      ]),
      n("Section", sectionPad(T.muted, 48), [
        container(560, [
          n("Heading", {
            text: "What happens next",
            level: 2,
            styles: {
              typography: { fontSize: 22, fontWeight: 700, textAlign: "center" },
              colors: { textColor: T.fg },
            },
          }),
          n("Paragraph", {
            text: "1. We review your request\n2. You receive a confirmation email\n3. Our team follows up within one business day",
            styles: {
              typography: { textAlign: "center", fontSize: 15, whiteSpace: "pre-line" },
              colors: { textColor: T.mutedFg },
              spacing: { marginTop: 16 },
            },
          }),
        ]),
      ]),
      n("Section", sectionPad(T.bg, 64), [
        container(480, [
          n(
            "Div",
            {
              styles: {
                layout: { display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" },
              },
            },
            [
              n("Button", {
                label: "Back to home",
                url: "/",
                styles: {
                  colors: { backgroundColor: T.primary, textColor: T.primaryFg },
                },
              }),
              n("Button", {
                label: "Browse resources",
                url: "#",
                variant: "secondary",
                styles: {
                  colors: {
                    backgroundColor: "transparent",
                    textColor: T.primary,
                    border: `1px solid ${T.border}`,
                  },
                },
              }),
            ],
          ),
        ]),
      ]),
    ]),

  "tpl-404": () =>
    buildPageLayout([
      n("Section", sectionPad(T.bg, 88), [
        container(560, [
          n("Heading", {
            text: "404 — Page not found",
            level: 1,
            styles: {
              typography: { fontSize: 40, fontWeight: 700, textAlign: "center" },
              colors: { textColor: T.fg },
            },
          }),
          n("Paragraph", {
            text: "The page you are looking for may have moved or no longer exists.",
            styles: {
              typography: { textAlign: "center" },
              colors: { textColor: T.mutedFg },
              spacing: { marginTop: 16, marginBottom: 28 },
            },
          }),
        ]),
      ]),
      n("Section", sectionPad(T.muted, 48), [
        container(640, [
          n("Heading", {
            text: "Popular destinations",
            level: 2,
            styles: {
              typography: { fontSize: 20, fontWeight: 600, textAlign: "center" },
              colors: { textColor: T.fg },
            },
          }),
          n(
            "Div",
            {
              styles: {
                layout: {
                  display: "flex",
                  justifyContent: "center",
                  gap: 20,
                  flexWrap: "wrap",
                  marginTop: 16,
                },
              },
            },
            [
              n("Link", { text: "Home", url: "/", linkStyles: { color: T.primary } }),
              n("Link", { text: "Contact", url: "/contact", linkStyles: { color: T.primary } }),
              n("Link", { text: "About", url: "/about", linkStyles: { color: T.primary } }),
            ],
          ),
        ]),
      ]),
      n("Section", sectionPad(T.bg, 64), [
        container(480, [
          n("Button", {
            label: "Go home",
            url: "/",
            styles: {
              colors: { backgroundColor: T.primary, textColor: T.primaryFg },
              spacing: { marginLeft: "auto", marginRight: "auto" },
            },
          }),
        ]),
      ]),
    ]),

  "tpl-privacy-policy": () =>
    buildPageLayout([
      prose(
        "Privacy Policy",
        "Replace this starter copy with your legal text. The sections below provide scannable headings for the most common policy topics.",
      ),
      prose(
        "Information we collect",
        "Describe categories of personal data you collect, why you collect them, and lawful bases where applicable.",
      ),
      prose(
        "Cookies and tracking",
        "Explain cookie categories, analytics tools, and how visitors can manage preferences.",
      ),
      prose(
        "Data retention",
        "State how long you retain data and the criteria used to determine retention periods.",
      ),
      prose(
        "Contact us",
        "Provide a privacy contact email or postal address for data subject requests.",
      ),
    ]),

  "tpl-generic-content": () =>
    buildPageLayout([
      prose(
        "Content page",
        "A flexible long-form starter for articles, guides, and resource pages.",
      ),
      n("Section", sectionPad(T.muted, 48), [
        container(960, [
          n("Image", {
            imageUrl: PLACEHOLDER_IMG,
            altText: "Article hero image",
            imageStyles: { borderRadius: 12 },
            styles: { spacing: { marginBottom: 24 } },
          }),
          n("Paragraph", {
            text: "Use this band for supporting detail, pull quotes, or inline imagery. Delete or extend it freely from the builder.",
            styles: {
              typography: { fontSize: 17, lineHeight: 1.7 },
              colors: { textColor: T.mutedFg },
            },
          }),
        ]),
      ]),
      n("Section", sectionPad(T.bg, 48), [
        container(760, [
          n("Heading", {
            text: "Related reading",
            level: 2,
            styles: {
              typography: { fontSize: 28, fontWeight: 700 },
              colors: { textColor: T.fg },
            },
          }),
          n("Paragraph", {
            text: "Link to related guides or add a blog grid from the section library.",
            styles: {
              colors: { textColor: T.mutedFg },
              spacing: { marginTop: 12 },
            },
          }),
        ]),
      ]),
    ]),

  "tpl-homepage": () =>
    buildPageLayout([
      hero(
        "Build a brand your customers remember",
        "Primary marketing homepage with proof, services, and a conversion path.",
        "Get started",
      ),
      features("Everything you need to launch", [
        {
          title: "On-brand from day one",
          description: "Theme tokens keep typography, color, and spacing consistent.",
          icon: "🎨",
        },
        {
          title: "Editable by your team",
          description: "Every block opens in the builder — no developer handoff required.",
          icon: "🧩",
        },
        {
          title: "Ready to publish",
          description: "Replace placeholders, connect forms, and ship when you are ready.",
          icon: "🚀",
        },
      ]),
      logoCloud(),
      statsBand(),
      testimonialQuote(),
      cardGridBand("SERVICES", "How we help you grow", DEFAULT_SERVICE_CARDS),
      ctaBand(
        "Ready to get started?",
        "Customize this homepage and publish your primary marketing site.",
      ),
    ]),

  "tpl-services": () =>
    buildPageLayout([
      hero(
        "Services built for outcomes",
        "Showcase what you offer with clear cards and a path to contact.",
        "Talk to us",
      ),
      cardGridBand("WHAT WE DO", "End-to-end support for your team", DEFAULT_SERVICE_CARDS),
      features("Why clients choose us", [
        {
          title: "Proven process",
          description: "Structured discovery, design, and delivery you can trust.",
          icon: "📋",
        },
        {
          title: "Flexible engagement",
          description: "Project-based or ongoing support — scale up or down as needed.",
          icon: "⚡",
        },
        {
          title: "Transparent pricing",
          description: "Clear scopes and milestones so there are no surprises.",
          icon: "💡",
        },
      ]),
      ctaBand("Need a custom scope?", "Point visitors to contact or book a discovery call."),
    ]),

  "tpl-pricing": () =>
    buildPageLayout([
      hero(
        "Plans that scale with you",
        "Transparent pricing with FAQs — ideal for product and SaaS sites.",
        "Compare plans",
      ),
      pricingBand(),
      faqBand(),
      ctaBand("Still have questions?", "Invite visitors to contact sales or start a trial."),
    ]),

  "tpl-team": () =>
    buildPageLayout([
      hero(
        "Meet the team",
        "Introduce the people behind your brand with roles, photos, and culture.",
        "Join us",
      ),
      prose(
        "Our culture",
        "Replace this paragraph with your mission and values. The team grid below gives visitors faces and roles they can connect with.",
      ),
      teamBand(),
      ctaBand("Want to join the team?", "Link to careers or an open roles page.", "View careers"),
    ]),

  "tpl-faq": () =>
    buildPageLayout([
      hero(
        "Questions? We have answers.",
        "Support hub with common questions and a clear next step.",
        "Contact support",
        "centered",
      ),
      faqBand(),
      ctaBand("Still need help?", "Direct visitors to contact or live support.", "Get in touch"),
    ]),

  "tpl-blog-listing": () =>
    buildPageLayout([
      prose(
        "Insights & updates",
        "Blog home starter with article cards. Swap the grid for a Collection List to bind live posts.",
      ),
      blogGridBand(),
      ctaBand("Never miss an update", "Add a newsletter signup or link to your RSS feed.", "Subscribe"),
    ]),

  "tpl-terms": () =>
    buildPageLayout([
      prose(
        "Terms & Conditions",
        "Replace this starter copy with your legal terms. The sections below provide scannable headings for common policy topics.",
      ),
      prose(
        "Acceptance of terms",
        "Describe how users accept these terms and when they take effect.",
      ),
      prose(
        "Use of services",
        "Explain permitted use, account responsibilities, and restrictions.",
      ),
      prose(
        "Limitation of liability",
        "State liability limits, disclaimers, and governing law where applicable.",
      ),
      prose(
        "Contact",
        "Provide a legal contact email or postal address for questions about these terms.",
      ),
    ]),

  "tpl-service-detail": () =>
    buildPageLayout([
      hero(
        "Dedicated support for your team",
        "Deep-dive service page with benefits, proof, and related offerings.",
        "Get started",
      ),
      features("What you get", [
        {
          title: "Expert delivery",
          description: "Specialists who understand your domain and deliver on time.",
          icon: "🎯",
        },
        {
          title: "Flexible scope",
          description: "Start small and expand as your needs evolve.",
          icon: "⚡",
        },
        {
          title: "Clear outcomes",
          description: "Defined milestones so you always know what comes next.",
          icon: "📈",
        },
      ]),
      prose(
        "How it works",
        "Replace this paragraph with your service process. Walk visitors through discovery, delivery, and ongoing support.",
      ),
      cardGridBand(
        "RELATED",
        "Explore related services",
        [
          {
            title: "Strategy & consulting",
            description: "Align stakeholders on goals and a roadmap you can execute.",
            imageUrl: PLACEHOLDER_IMG,
          },
          {
            title: "Design & build",
            description: "Ship on-brand pages with reusable sections your team can edit.",
            imageUrl: PLACEHOLDER_IMG,
          },
          {
            title: "Launch & optimize",
            description: "Publish confidently, then iterate with analytics and experiments.",
            imageUrl: PLACEHOLDER_IMG,
          },
        ],
      ),
      ctaBand("Ready to learn more?", "Point visitors to contact or book a discovery call."),
    ]),

  "tpl-industry-detail": () =>
    buildPageLayout([
      hero(
        "Solutions for your industry",
        "Vertical landing page with outcomes, proof, and a path to contact.",
        "Talk to us",
        "split",
        PLACEHOLDER_IMG,
      ),
      statsBand(),
      features("Built for your sector", [
        {
          title: "Domain expertise",
          description: "Teams who understand the regulations and workflows in your space.",
          icon: "🏢",
        },
        {
          title: "Proven results",
          description: "Case studies and metrics from organizations like yours.",
          icon: "📊",
        },
        {
          title: "Scalable support",
          description: "Grow from pilot to enterprise without changing partners.",
          icon: "🚀",
        },
      ]),
      testimonialQuote(),
      ctaBand("See how we can help", "Invite visitors to explore services or schedule a call."),
    ]),

  "tpl-careers": () =>
    buildPageLayout([
      hero(
        "Build your career with us",
        "Employer brand page with culture story, open roles, and an apply CTA.",
        "View open roles",
      ),
      prose(
        "Life at our company",
        "Replace this paragraph with your mission, values, and what makes your team unique.",
      ),
      cardGridBand(
        "OPEN ROLES",
        "Current opportunities",
        [
          {
            title: "Senior Product Designer",
            description: "Remote · Full-time · Design systems and visual builder UX.",
          },
          {
            title: "Full-stack Engineer",
            description: "Hybrid · Full-time · TypeScript, React, and API services.",
          },
          {
            title: "Customer Success Manager",
            description: "Remote · Full-time · Onboarding and retention for SaaS clients.",
          },
        ],
      ),
      teamBand(),
      ctaBand("Don't see your role?", "Invite candidates to send a general application.", "Apply now"),
    ]),

  "tpl-features": () =>
    buildPageLayout([
      hero(
        "Everything you need in one platform",
        "Product features page with a benefit grid and a conversion path.",
        "Explore features",
      ),
      features("Core capabilities", [
        {
          title: "Visual builder",
          description: "Drag-and-drop sections with theme tokens applied automatically.",
          icon: "🧩",
        },
        {
          title: "Starter templates",
          description: "Launch pages in minutes with production-ready layouts.",
          icon: "📄",
        },
        {
          title: "Team workflows",
          description: "Draft, review, and publish with roles and audit history.",
          icon: "👥",
        },
      ]),
      n("Section", sectionPad(T.muted, 64), [
        container(1100, [
          n(
            "Grid",
            {
              columns: 2,
              styles: {
                layout: {
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 32,
                  alignItems: "center",
                },
              },
            },
            [
              n("Column", {}, [
                n("Heading", {
                  text: "Deep dive on what matters",
                  level: 2,
                  styles: {
                    typography: { fontSize: 32, fontWeight: 700 },
                    colors: { textColor: T.fg },
                  },
                }),
                n("Paragraph", {
                  text: "Pair a strong visual with detailed feature copy. Swap the image or add a video embed from the builder.",
                  styles: {
                    colors: { textColor: T.mutedFg },
                    spacing: { marginTop: 12 },
                  },
                }),
              ]),
              n("Column", {}, [
                n("Image", {
                  imageUrl: PLACEHOLDER_IMG,
                  altText: "Feature screenshot",
                  imageStyles: { borderRadius: 12 },
                }),
              ]),
            ],
          ),
        ]),
      ]),
      ctaBand("See it in action", "Link to a demo, trial signup, or product tour."),
    ]),

  "tpl-testimonials": () =>
    buildPageLayout([
      hero(
        "Trusted by teams worldwide",
        "Social proof page with customer quotes and a closing CTA.",
        "Read stories",
      ),
      testimonialQuote(),
      n("Section", sectionPad(T.bg, 48), [
        container(1100, [
          n("Section Heading", {
            subtitle: "CUSTOMERS",
            title: "More voices from the field",
            align: "center",
            styles: { spacing: { marginBottom: 32 } },
          }),
          n("Feature List", {
            columns: 3,
            features: [
              {
                title: "“Cut launch time in half”",
                description: "Operations Lead · Retail",
                icon: "💬",
              },
              {
                title: "“On-brand without a designer”",
                description: "Marketing Director · SaaS",
                icon: "💬",
              },
              {
                title: "“Our team edits pages themselves”",
                description: "Founder · Agency",
                icon: "💬",
              },
            ],
          }),
        ]),
      ]),
      logoCloud(),
      ctaBand("Join our customers", "Invite visitors to start a trial or book a demo."),
    ]),

  "tpl-product-landing": () =>
    buildPageLayout([
      hero(
        "Introducing your next product",
        "Product launch landing with features, proof, pricing, and a conversion CTA.",
        "Buy now",
        "split",
        PLACEHOLDER_IMG,
      ),
      features("Why customers love it", [
        {
          title: "Fast setup",
          description: "Go from unboxing to first value in minutes, not days.",
          icon: "⚡",
        },
        {
          title: "Built to last",
          description: "Premium materials and thoughtful design for daily use.",
          icon: "✨",
        },
        {
          title: "Support included",
          description: "Real humans available when you need help.",
          icon: "🤝",
        },
      ]),
      testimonialQuote(),
      pricingBand(),
      ctaBand("Ready to order?", "Customize the offer and publish your product landing."),
    ]),

  "tpl-case-study": () =>
    buildPageLayout([
      hero(
        "How Acme scaled their pipeline",
        "Customer story with challenge, approach, results, and a closing CTA.",
        "Read the story",
      ),
      prose(
        "The challenge",
        "Replace this paragraph with the customer's starting situation — pain points, constraints, and goals.",
      ),
      prose(
        "The approach",
        "Describe the solution you delivered: scope, timeline, and key decisions along the way.",
      ),
      statsBand(),
      galleryBand(),
      ctaBand("Want similar results?", "Invite visitors to contact sales or read more case studies."),
    ]),

  "tpl-blog-detail": () =>
    buildPageLayout([
      prose(
        "Article title goes here",
        "Replace with your article intro or dek. The body and hero image bands below form a standard blog post layout.",
      ),
      n("Section", sectionPad(T.muted, 48), [
        container(960, [
          n("Image", {
            imageUrl: PLACEHOLDER_IMG,
            altText: "Article hero image",
            imageStyles: { borderRadius: 12 },
            styles: { spacing: { marginBottom: 24 } },
          }),
          n("Paragraph", {
            text: "Article body copy lives here. Replace with rich text from your CMS content record or extend with additional prose blocks from the builder.",
            styles: {
              typography: { fontSize: 17, lineHeight: 1.7 },
              colors: { textColor: T.mutedFg },
            },
          }),
          n("Paragraph", {
            text: "Published · March 15, 2026 · By Jordan Lee",
            styles: {
              typography: { fontSize: 14 },
              colors: { textColor: T.mutedFg },
              spacing: { marginTop: 24 },
            },
          }),
        ]),
      ]),
      blogGridBand(),
      ctaBand("Enjoyed this article?", "Link to related posts or invite readers to subscribe.", "Subscribe"),
    ]),

  "tpl-resource-listing": () =>
    buildPageLayout([
      hero(
        "Guides, templates, and downloads",
        "Resource hub with cards for guides, PDFs, and case studies.",
        "Browse all",
      ),
      cardGridBand(
        "RESOURCES",
        "Featured downloads",
        [
          {
            title: "Getting started guide",
            description: "Step-by-step onboarding for new teams.",
            imageUrl: PLACEHOLDER_IMG,
          },
          {
            title: "Brand toolkit",
            description: "Logos, colors, and messaging guidelines.",
            imageUrl: PLACEHOLDER_IMG,
          },
          {
            title: "ROI calculator",
            description: "Spreadsheet template to estimate impact.",
            imageUrl: PLACEHOLDER_IMG,
          },
          {
            title: "Security overview",
            description: "PDF summary of compliance and data handling.",
            imageUrl: PLACEHOLDER_IMG,
          },
          {
            title: "Case study pack",
            description: "Three customer stories with metrics.",
            imageUrl: PLACEHOLDER_IMG,
          },
          {
            title: "Webinar replay",
            description: "Recording and slides from our latest session.",
            imageUrl: PLACEHOLDER_IMG,
          },
        ],
        3,
      ),
      ctaBand("Need something specific?", "Point visitors to contact or a gated content form."),
    ]),

  "tpl-resource-detail": () =>
    buildPageLayout([
      prose(
        "Resource title",
        "Replace with a summary of this guide, PDF, or case study. Explain who it is for and what they will learn.",
      ),
      n("Section", sectionPad(T.muted, 48), [
        container(760, [
          n("Image", {
            imageUrl: PLACEHOLDER_IMG,
            altText: "Resource cover",
            imageStyles: { borderRadius: 12 },
            styles: { spacing: { marginBottom: 24 } },
          }),
          n("Paragraph", {
            text: "Add supporting detail, bullet points, or a table of contents. Connect the download button to your asset URL or gated form.",
            styles: {
              typography: { fontSize: 16, lineHeight: 1.6 },
              colors: { textColor: T.mutedFg },
            },
          }),
          n("Button", {
            label: "Download PDF",
            url: "#",
            styles: {
              colors: { backgroundColor: T.primary, textColor: T.primaryFg },
              spacing: { marginTop: 24 },
            },
          }),
        ]),
      ]),
      cardGridBand(
        "RELATED",
        "More resources",
        [
          {
            title: "Getting started guide",
            description: "Onboarding checklist for new teams.",
          },
          {
            title: "Security overview",
            description: "Compliance and data handling summary.",
          },
          {
            title: "Case study pack",
            description: "Customer stories with measurable outcomes.",
          },
        ],
      ),
      ctaBand("Questions about this resource?", "Invite visitors to contact your team.", "Contact us"),
    ]),
};
