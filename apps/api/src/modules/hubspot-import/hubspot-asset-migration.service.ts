import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { eq, isNull } from "drizzle-orm";
import {
  buildHubspotAssetMigrationUrlMap,
  HUBSPOT_ASSET_MIGRATION_DIAGNOSTIC_CODES,
  HUBSPOT_CONNECTOR_ID,
  type HubspotDiscoveredAsset,
  type HubspotExtractionDiagnostic,
  type HubspotUniversalPage,
} from "@ob-cms/block-schema";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import {
  connectorAssetMappings,
  type ConnectorAssetMappingRow,
  type NewConnectorAssetMappingRow,
} from "@database/schema";
import { MediaService } from "@modules/media/media.service";
import { HubspotAssetFetchBodyError, readFetchResponseBodyLimited } from "./hubspot-asset-fetch-body";
import {
  assertApprovedHubspotAssetFetchUrl,
  isHubspotApiFetchHostname,
  resolveHubspotAssetRedirectTarget,
} from "./hubspot-asset-fetch-url";

const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const MIGRATION_FETCH_TIMEOUT_MS = 30_000;
const MAX_ASSET_FETCH_REDIRECTS = 5;
const MAX_MAPPING_ERROR_LENGTH = 2000;

export interface HubspotAssetMigrationResult {
  urlMap: Record<string, string>;
  diagnostics: HubspotExtractionDiagnostic[];
}

const filenameFromUrl = (url: string): string => {
  try {
    const path = new URL(url).pathname;
    const base = path.split("/").filter(Boolean).pop();
    if (base && base.includes(".")) return base.slice(0, 200);
  } catch {
    /* fall through */
  }
  return `hubspot-asset-${createHash("sha256").update(url).digest("hex").slice(0, 12)}.bin`;
};

const contentTypeFromBytes = (body: Buffer, url: string): string => {
  if (body[0] === 0xff && body[1] === 0xd8) return "image/jpeg";
  if (body[0] === 0x89 && body[1] === 0x50) return "image/png";
  if (body[0] === 0x47 && body[1] === 0x49) return "image/gif";
  if (body.slice(0, 4).toString("ascii") === "RIFF") return "image/webp";
  const lower = url.toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
};

@Injectable()
export class HubspotAssetMigrationService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly media: MediaService,
  ) {}

  async migrateUpmAssets(
    connectionId: string,
    upm: HubspotUniversalPage,
    accessToken: string,
    actor: AuthUser,
  ): Promise<HubspotAssetMigrationResult> {
    const diagnostics: HubspotExtractionDiagnostic[] = [];
    const identityToObUrl = new Map<string, string>();

    for (const asset of upm.assets) {
      try {
        const obUrl = await this.resolveObUrlForAsset(connectionId, asset, accessToken, actor, diagnostics);
        if (obUrl) {
          identityToObUrl.set(asset.identityKey, obUrl);
          if (asset.role === "responsive_variant") {
            diagnostics.push({
              code: HUBSPOT_ASSET_MIGRATION_DIAGNOSTIC_CODES.ASSET_RESPONSIVE_SOURCE_PRESERVED,
              severity: "info",
              message: "Migrated responsive HubSpot media URL; block props may still reference desktop src only.",
              path: asset.discoveredAtPath,
            });
          }
        }
      } catch (err) {
        diagnostics.push({
          code: HUBSPOT_ASSET_MIGRATION_DIAGNOSTIC_CODES.ASSET_UPLOAD_FAILED,
          severity: "warning",
          message: err instanceof Error ? err.message : "Asset migration failed.",
          path: asset.discoveredAtPath,
        });
      }
    }

    const urlMap = buildHubspotAssetMigrationUrlMap(upm, identityToObUrl);
    return { urlMap, diagnostics };
  }

  private async resolveObUrlForAsset(
    connectionId: string,
    asset: HubspotDiscoveredAsset,
    accessToken: string,
    actor: AuthUser,
    diagnostics: HubspotExtractionDiagnostic[],
  ): Promise<string | undefined> {
    const existing = await this.findReadyMapping(connectionId, asset.identityKey);
    if (existing?.obUrl) {
      diagnostics.push({
        code: HUBSPOT_ASSET_MIGRATION_DIAGNOSTIC_CODES.ASSET_REUSED_EXISTING,
        severity: "info",
        message: "Reused existing migrated HubSpot asset.",
        path: asset.discoveredAtPath,
      });
      return existing.obUrl;
    }

    const downloaded = await this.downloadAsset(asset.url, accessToken);
    if (!downloaded) {
      diagnostics.push({
        code: HUBSPOT_ASSET_MIGRATION_DIAGNOSTIC_CODES.ASSET_DOWNLOAD_FAILED,
        severity: "warning",
        message: "Failed to download HubSpot asset; source URL preserved.",
        path: asset.discoveredAtPath,
      });
      await this.recordFailedMapping(connectionId, asset, "Download failed.");
      return undefined;
    }

    const checksum = createHash("sha256").update(downloaded.body).digest("hex");
    const row = await this.media.importFromBytes(
      {
        filename: filenameFromUrl(asset.url),
        contentType: downloaded.contentType,
        body: downloaded.body,
        byteSize: downloaded.body.length,
      },
      actor,
    );

    if (row.status === "failed") {
      await this.recordFailedMapping(connectionId, asset, "Media processing failed.");
      await this.media.remove(row.id, actor);
      return undefined;
    }

    await this.persistReadyMapping(
      connectionId,
      asset,
      {
        mediaId: row.id,
        obUrl: row.url ?? undefined,
        contentType: downloaded.contentType,
        byteSize: downloaded.body.length,
        checksumSha256: checksum,
      },
      actor,
    );

    const winner = await this.findReadyMapping(connectionId, asset.identityKey);
    return winner?.obUrl ?? row.url ?? undefined;
  }

  private async persistReadyMapping(
    connectionId: string,
    asset: HubspotDiscoveredAsset,
    ready: {
      mediaId: string;
      obUrl: string | undefined;
      contentType: string;
      byteSize: number;
      checksumSha256: string;
    },
    actor: AuthUser,
  ): Promise<void> {
    const values = {
      connectionId,
      sourceSystem: HUBSPOT_CONNECTOR_ID,
      identityKey: asset.identityKey,
      sourceUrl: asset.url,
      hubspotFileId: asset.hubspotFileId ?? null,
      discoveredAtPath: asset.discoveredAtPath,
      mediaId: ready.mediaId,
      obUrl: ready.obUrl ?? null,
      status: "ready" as const,
      contentType: ready.contentType,
      byteSize: ready.byteSize,
      checksumSha256: ready.checksumSha256,
      error: null,
      metadata: { normalizedUrl: asset.normalizedUrl },
    };

    await this.insertMappingIfAbsent({ ...this.repo.insertDefaults(), ...values });
    const existing = await this.findAnyMapping(connectionId, asset.identityKey);
    if (!existing) return;
    if (existing.status === "ready" && existing.mediaId !== ready.mediaId) {
      await this.media.remove(ready.mediaId, actor);
      return;
    }
    await this.repo.db
      .update(connectorAssetMappings)
      .set(values)
      .where(
        this.repo.scope(
          connectorAssetMappings,
          eq(connectorAssetMappings.id, existing.id),
          isNull(connectorAssetMappings.deletedAt),
        ),
      );
  }

  private async recordFailedMapping(
    connectionId: string,
    asset: HubspotDiscoveredAsset,
    error: string,
  ): Promise<void> {
    const existingBefore = await this.findAnyMapping(connectionId, asset.identityKey);
    if (existingBefore?.status === "ready") return;

    const failedValues = {
      connectionId,
      sourceSystem: HUBSPOT_CONNECTOR_ID,
      identityKey: asset.identityKey,
      sourceUrl: asset.url,
      hubspotFileId: asset.hubspotFileId ?? null,
      discoveredAtPath: asset.discoveredAtPath,
      status: "failed" as const,
      error: error.slice(0, MAX_MAPPING_ERROR_LENGTH),
      metadata: { normalizedUrl: asset.normalizedUrl },
    };

    await this.insertMappingIfAbsent({ ...this.repo.insertDefaults(), ...failedValues });
    const existing = await this.findAnyMapping(connectionId, asset.identityKey);
    if (!existing || existing.status === "ready") return;
    await this.repo.db
      .update(connectorAssetMappings)
      .set({
        status: "failed",
        error: failedValues.error,
        sourceUrl: asset.url,
        discoveredAtPath: asset.discoveredAtPath,
        metadata: failedValues.metadata,
      })
      .where(
        this.repo.scope(
          connectorAssetMappings,
          eq(connectorAssetMappings.id, existing.id),
          isNull(connectorAssetMappings.deletedAt),
        ),
      );
  }

  private async insertMappingIfAbsent(values: NewConnectorAssetMappingRow): Promise<void> {
    await this.repo.db
      .insert(connectorAssetMappings)
      .values(values)
      .onConflictDoNothing();
  }

  private async findReadyMapping(
    connectionId: string,
    identityKey: string,
  ): Promise<ConnectorAssetMappingRow | undefined> {
    const [row] = await this.repo.db
      .select()
      .from(connectorAssetMappings)
      .where(
        this.repo.scope(
          connectorAssetMappings,
          eq(connectorAssetMappings.connectionId, connectionId),
          eq(connectorAssetMappings.identityKey, identityKey),
          eq(connectorAssetMappings.status, "ready"),
          isNull(connectorAssetMappings.deletedAt),
        ),
      )
      .limit(1);
    return row;
  }

  private async findAnyMapping(
    connectionId: string,
    identityKey: string,
  ): Promise<ConnectorAssetMappingRow | undefined> {
    const [row] = await this.repo.db
      .select()
      .from(connectorAssetMappings)
      .where(
        this.repo.scope(
          connectorAssetMappings,
          eq(connectorAssetMappings.connectionId, connectionId),
          eq(connectorAssetMappings.identityKey, identityKey),
          isNull(connectorAssetMappings.deletedAt),
        ),
      )
      .limit(1);
    return row;
  }

  private async downloadAsset(
    url: string,
    accessToken: string,
  ): Promise<{ body: Buffer; contentType: string } | null> {
    let current: URL;
    try {
      current = assertApprovedHubspotAssetFetchUrl(url);
    } catch {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MIGRATION_FETCH_TIMEOUT_MS);
    try {
      for (let redirectCount = 0; redirectCount <= MAX_ASSET_FETCH_REDIRECTS; redirectCount += 1) {
        const headers: Record<string, string> = {};
        if (isHubspotApiFetchHostname(current.hostname)) {
          headers.Authorization = `Bearer ${accessToken}`;
        }

        const res = await fetch(current.toString(), {
          headers,
          redirect: "manual",
          signal: controller.signal,
        });

        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get("location");
          if (!location || redirectCount >= MAX_ASSET_FETCH_REDIRECTS) return null;
          try {
            current = resolveHubspotAssetRedirectTarget(current, location);
          } catch {
            return null;
          }
          continue;
        }

        if (!res.ok) return null;

        let body: Buffer;
        try {
          body = await readFetchResponseBodyLimited(res, MAX_ASSET_BYTES);
        } catch (err) {
          if (err instanceof HubspotAssetFetchBodyError) return null;
          throw err;
        }

        const headerType = res.headers.get("content-type")?.split(";")[0]?.trim();
        const contentType =
          headerType && headerType.length > 0 ? headerType : contentTypeFromBytes(body, current.toString());
        return { body, contentType };
      }
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
