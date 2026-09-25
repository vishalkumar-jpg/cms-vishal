import { Module } from "@nestjs/common";
import { ApiKeysController } from "./api-keys.controller";
import { ApiKeysService } from "./api-keys.service";
import { ContentApiController } from "./content-api.controller";
import { ContentApiService } from "./content-api.service";
import { ContentApiKeyGuard } from "./content-api-key.guard";

/**
 * Content API (E27).
 *  - ApiKeysController/Service — admin (site_admin) CRUD for API keys (show-once).
 *  - ContentApiController/Service — the PUBLIC read-only `/api/v1/content` surface
 *    guarded by ContentApiKeyGuard (the key resolves the tenant; no cross-site).
 */
@Module({
  controllers: [ApiKeysController, ContentApiController],
  providers: [ApiKeysService, ContentApiService, ContentApiKeyGuard],
  exports: [ApiKeysService],
})
export class ContentApiModule {}
