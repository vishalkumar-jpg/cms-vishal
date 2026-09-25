import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import type {
  ComponentProp,
  ComponentVariant,
  SerializedLayout,
} from "@ob-cms/block-schema";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { reusableBlocks } from "@database/schema";
import { SiteResolver } from "@modules/seo/site-resolver.service";

/**
 * PUBLIC reusable-block resolver (REUSE-BLOCKS). The site is resolved
 * SERVER-SIDE from the Host header (NEVER a client-supplied siteId); the block
 * must belong to that site (else 404, no existence leak). The renderer's
 * same-origin proxy calls this to resolve a `ReusableBlock` reference at render.
 */
@Injectable()
export class PublicReusableBlocksService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly resolver: SiteResolver,
  ) {}

  /**
   * Resolve a reusable block's layout for the host's site, or 404. COMPONENTS:
   * also returns the declared `props`/`variants` so the renderer can resolve a
   * component INSTANCE (variant + overrides + componentBindings). Both are `[]`
   * for a plain reusable block, so existing instances resolve unchanged.
   */
  async getLayout(
    host: string | undefined,
    id: string,
  ): Promise<{
    id: string;
    name: string;
    layout: SerializedLayout;
    props: ComponentProp[];
    variants: ComponentVariant[];
  }> {
    const site = await this.resolver.resolve(host);
    if (!site) throw new NotFoundException("Site not found for host");

    const [row] = await this.db
      .select()
      .from(reusableBlocks)
      .where(
        and(
          eq(reusableBlocks.id, id),
          eq(reusableBlocks.siteId, site.id),
          isNull(reusableBlocks.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Reusable block not found");

    return {
      id: row.id,
      name: row.name,
      layout: row.layout as SerializedLayout,
      props: (row.props as ComponentProp[] | null) ?? [],
      variants: (row.variants as ComponentVariant[] | null) ?? [],
    };
  }
}
