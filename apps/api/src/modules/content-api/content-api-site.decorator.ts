import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { ContentApiRequest } from "./content-api-key.guard";

/**
 * `@ContentApiSiteId()` — inject the site id resolved by ContentApiKeyGuard from
 * the presented API key. The key IS the tenant, so this is the only site a
 * Content-API request may read.
 */
export const ContentApiSiteId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<ContentApiRequest>();
    if (!req.contentApiSiteId) {
      // The guard always sets this before a handler runs; defensive only.
      throw new Error("Content API site not resolved (guard did not run)");
    }
    return req.contentApiSiteId;
  },
);
