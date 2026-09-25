import * as React from "react";

/**
 * Lightweight CSS wireframe thumbnails for palette blocks — schematic previews
 * using theme tokens (no rendered Craft tree). Mirrors SectionLibraryPanel thumbs.
 */

const bar = (w: string, h = 6, primary = false, round = 3): React.ReactNode => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: round,
      background: primary ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.35)",
    }}
  />
);

const cols = (count: number, h = 18): React.ReactNode => (
  <div style={{ display: "flex", gap: 4, width: "72%" }}>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        style={{
          flex: 1,
          height: h,
          borderRadius: 3,
          background: "hsl(var(--muted-foreground) / 0.25)",
        }}
      />
    ))}
  </div>
);

const box = (w: string | number, h: number, round = 4): React.ReactNode => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: round,
      background: "hsl(var(--muted-foreground) / 0.22)",
    }}
  />
);

const THUMB_BY_BLOCK: Record<string, React.ReactNode> = {
  /* Layout */
  Section: box("88%", 28, 4),
  Container: (
    <div style={{ width: "70%", padding: "4px 0", display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
      {bar("100%", 5)}
      {bar("75%", 5)}
    </div>
  ),
  Row: (
    <div style={{ display: "flex", gap: 5, width: "78%" }}>
      <div style={{ flex: 1, height: 22, borderRadius: 3, background: "hsl(var(--muted-foreground) / 0.25)" }} />
      <div style={{ flex: 1, height: 22, borderRadius: 3, background: "hsl(var(--muted-foreground) / 0.25)" }} />
    </div>
  ),
  Column: (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "40%" }}>
      {bar("100%", 5)}
      {bar("100%", 5)}
      {bar("100%", 5)}
    </div>
  ),
  Grid: (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, width: "60%" }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ height: 14, borderRadius: 2, background: "hsl(var(--muted-foreground) / 0.25)" }} />
      ))}
    </div>
  ),
  Div: (
    <div
      style={{
        width: "70%",
        height: 28,
        borderRadius: 4,
        border: "1.5px dashed hsl(var(--muted-foreground) / 0.4)",
      }}
    />
  ),
  Divider: (
    <div style={{ width: "80%", height: 2, borderRadius: 1, background: "hsl(var(--muted-foreground) / 0.35)" }} />
  ),

  /* Content */
  Heading: bar("62%", 9),
  Paragraph: (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, width: "75%" }}>
      {bar("100%", 4)}
      {bar("92%", 4)}
      {bar("68%", 4)}
    </div>
  ),
  "Section Heading": (
    <>
      {bar("28%", 4)}
      {bar("58%", 7)}
    </>
  ),
  Button: bar("34%", 10, true, 5),
  Link: (
    <div style={{ width: "40%", height: 2, borderRadius: 1, background: "hsl(var(--primary))", marginTop: 2 }} />
  ),
  Image: box("55%", 32, 4),
  Icon: (
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: 999,
        background: "hsl(var(--primary) / 0.25)",
        border: "2px solid hsl(var(--primary))",
      }}
    />
  ),
  Embed: (
    <div style={{ fontFamily: "monospace", fontSize: 10, color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
      {"</>"}
    </div>
  ),

  /* Navigation */
  Navbar: (
    <div style={{ display: "flex", alignItems: "center", gap: 6, width: "85%" }}>
      {box(16, 10, 2)}
      <div style={{ flex: 1, display: "flex", gap: 4, justifyContent: "center" }}>
        {bar("14%", 3)}
        {bar("14%", 3)}
        {bar("14%", 3)}
      </div>
      {bar("18%", 8, true, 3)}
    </div>
  ),
  Topbar: (
    <div style={{ width: "90%", height: 8, borderRadius: 2, background: "hsl(var(--primary) / 0.35)" }} />
  ),

  /* Media */
  Video: (
    <div style={{ position: "relative", width: "60%", height: 30, borderRadius: 4, background: "hsl(var(--muted-foreground) / 0.2)" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: "6px solid transparent",
            borderBottom: "6px solid transparent",
            borderLeft: "10px solid hsl(var(--primary))",
          }}
        />
      </div>
    </div>
  ),
  "Logo Carousel": (
    <div style={{ display: "flex", gap: 5, width: "80%", justifyContent: "center" }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ width: 20, height: 12, borderRadius: 2, background: "hsl(var(--muted-foreground) / 0.3)" }} />
      ))}
    </div>
  ),
  "Content Carousel": (
    <>
      {box("50%", 22, 3)}
      <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
        {[true, false, false].map((on, i) => (
          <div
            key={i}
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: on ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)",
            }}
          />
        ))}
      </div>
    </>
  ),
  "Video Testimonial Carousel": (
    <div style={{ display: "flex", gap: 5, width: "75%" }}>
      <div style={{ flex: 1, height: 26, borderRadius: 3, background: "hsl(var(--muted-foreground) / 0.25)", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 8, height: 8, borderRadius: 999, background: "hsl(var(--primary) / 0.6)" }} />
        </div>
      </div>
      <div style={{ flex: 0.6, height: 26, borderRadius: 3, background: "hsl(var(--muted-foreground) / 0.15)" }} />
    </div>
  ),
  "Article Card Grid": (
    <div style={{ display: "flex", gap: 4, width: "75%" }}>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ height: 14, borderRadius: 2, background: "hsl(var(--muted-foreground) / 0.25)" }} />
          {bar("90%", 3)}
          {bar("60%", 3)}
        </div>
      ))}
    </div>
  ),

  /* Marketing */
  "Hero Section": (
    <div style={{ display: "flex", gap: 6, width: "78%", alignItems: "center" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
        {bar("95%", 6)}
        {bar("70%", 4)}
        {bar("35%", 7, true, 3)}
      </div>
      <div style={{ flex: 0.9, height: 28, borderRadius: 3, background: "hsl(var(--muted-foreground) / 0.22)" }} />
    </div>
  ),
  "Feature List": cols(3, 20),
  "Counter Section": (
    <div style={{ display: "flex", gap: 8, width: "80%", justifyContent: "center" }}>
      {["40", "24", "4k"].map((n) => (
        <div key={n} style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--primary))", lineHeight: 1 }}>{n}</div>
          {bar("100%", 3)}
        </div>
      ))}
    </div>
  ),
  "Step Cards": (
    <div style={{ display: "flex", gap: 4, width: "85%" }}>
      {["1", "2", "3"].map((n) => (
        <div key={n} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: "hsl(var(--primary))",
              fontSize: 7,
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
            }}
          >
            {n}
          </div>
          {bar("90%", 3)}
        </div>
      ))}
    </div>
  ),

  /* Forms */
  Form: (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "55%" }}>
      <div style={{ height: 8, borderRadius: 2, border: "1px solid hsl(var(--muted-foreground) / 0.35)" }} />
      <div style={{ height: 8, borderRadius: 2, border: "1px solid hsl(var(--muted-foreground) / 0.35)" }} />
      {bar("40%", 8, true, 3)}
    </div>
  ),
  Search: (
    <div
      style={{
        width: "60%",
        height: 12,
        borderRadius: 6,
        border: "1px solid hsl(var(--muted-foreground) / 0.35)",
        display: "flex",
        alignItems: "center",
        paddingLeft: 6,
      }}
    >
      <div style={{ width: 6, height: 6, borderRadius: 999, border: "1.5px solid hsl(var(--muted-foreground) / 0.4)" }} />
    </div>
  ),

  /* Dynamic */
  "Collection List": (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "70%" }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <div style={{ width: 14, height: 10, borderRadius: 2, background: "hsl(var(--muted-foreground) / 0.25)" }} />
          {bar("70%", 4)}
        </div>
      ))}
    </div>
  ),
  Repeater: cols(2, 14),
  Experiment: (
    <div style={{ display: "flex", gap: 4, width: "70%" }}>
      <div style={{ flex: 1, height: 22, borderRadius: 3, border: "2px solid hsl(var(--primary) / 0.5)" }} />
      <div style={{ flex: 1, height: 22, borderRadius: 3, background: "hsl(var(--muted-foreground) / 0.15)" }} />
    </div>
  ),

  /* Footer */
  Footer: (
    <div style={{ width: "85%", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ height: 16, borderRadius: 2, background: "hsl(var(--muted-foreground) / 0.2)" }} />
      {bar("50%", 3)}
    </div>
  ),
  "Footer Columns": cols(4, 16),
  "Footer Links": (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, width: "40%" }}>
      {bar("60%", 4, true)}
      {bar("80%", 3)}
      {bar("70%", 3)}
      {bar("75%", 3)}
    </div>
  ),
  "Social Icons": (
    <div style={{ display: "flex", gap: 5 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ width: 12, height: 12, borderRadius: 999, border: "1.5px solid hsl(var(--muted-foreground) / 0.4)" }} />
      ))}
    </div>
  ),
  "Copyright Block": bar("55%", 4),
};

export const BlockThumbnail: React.FC<{ name: string }> = ({ name }) => {
  const shape = THUMB_BY_BLOCK[name] ?? (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
      {bar("50%", 6)}
      {bar("35%", 4)}
    </div>
  );

  return (
    <div
      aria-hidden
      className="flex h-16 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-md border border-border/60 bg-muted/40"
    >
      {shape}
    </div>
  );
};
