import type { Metadata, Viewport } from "next";
import "./globals.css";
// Global block styles (fonts, reset, design tokens, container queries) ported
// from the POC so rendered blocks match the live site. Scoped under `.ob-site`.
import "@ob-cms/blocks/blocks.css";
import { SiteShell } from "@/components/site-shell";
import { stagingRobotsMetadataOrUndefined } from "@/lib/indexing-policy";

export async function generateMetadata(): Promise<Metadata> {
  const stagingRobots = stagingRobotsMetadataOrUndefined();
  return {
    title: "OB-CMS Site",
    description: "Rendered by the OB-CMS public renderer",
    ...(stagingRobots ? { robots: stagingRobots } : {}),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
