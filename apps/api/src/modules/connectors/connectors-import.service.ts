import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import {
  CONNECTOR_CAPABILITY,
  connectorHasCapability,
  getConnector,
  HUBSPOT_CONNECTOR_ID,
  parseConnectorCredentials,
  resolveCredentialKeys,
  type HubspotImportScope,
} from "@ob-cms/block-schema";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import {
  connectorConnections,
  type ConnectorConnectionRow,
} from "@database/schema/connector-connections.schema";
import { EncryptionService } from "@modules/ai/encryption.service";
import {
  HubspotImportService,
  type HubspotScopedImportPreview,
  type ImportSummary,
} from "@modules/hubspot-import/hubspot-import.service";
import type { ConnectorImportRunResponseDto } from "./dto/import-runs.dto";
import { ImportRunsService } from "./import-runs.service";

/**
 * Connection-scoped content import. Resolves encrypted credentials for the
 * active site connection and delegates to the existing provider import service.
 */
@Injectable()
export class ConnectorsImportService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly encryption: EncryptionService,
    private readonly hubspotImport: HubspotImportService,
    private readonly importRuns: ImportRunsService,
  ) {}

  async previewImport(
    connectionId: string,
    scope: HubspotImportScope,
  ): Promise<HubspotScopedImportPreview> {
    const { connectorId, accessToken } = await this.resolveImportAccess(connectionId);
    if (connectorId === HUBSPOT_CONNECTOR_ID) {
      return this.hubspotImport.previewScoped(accessToken, scope);
    }
    throw new BadRequestException(`Import is not supported for connector "${connectorId}".`);
  }

  async runImport(
    connectionId: string,
    scope: HubspotImportScope,
    actor: AuthUser,
  ): Promise<ConnectorImportRunResponseDto> {
    const row = await this.loadActiveConnection(connectionId);
    const { connectorId, accessToken } = await this.resolveImportAccessFromRow(row);

    const run = await this.importRuns.startRun(row, scope, actor);

    let summary: ImportSummary;
    try {
      if (connectorId === HUBSPOT_CONNECTOR_ID) {
        summary = await this.hubspotImport.runScoped(accessToken, scope, actor, {
          connectionId: row.id,
          runId: run.id,
        });
      } else {
        throw new BadRequestException(`Import is not supported for connector "${connectorId}".`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed.";
      await this.importRuns.completeRunFailure(run.id, message, actor);
      throw err;
    }

    return this.importRuns.completeRunSuccess(run.id, summary, actor);
  }

  private async resolveImportAccess(
    connectionId: string,
  ): Promise<{ connectorId: string; accessToken: string }> {
    const row = await this.loadActiveConnection(connectionId);
    return this.resolveImportAccessFromRow(row);
  }

  private async resolveImportAccessFromRow(
    row: ConnectorConnectionRow,
  ): Promise<{ connectorId: string; accessToken: string }> {
    const adapter = getConnector(row.connectorId);
    if (
      !adapter ||
      !connectorHasCapability(adapter.definition.capabilities, CONNECTOR_CAPABILITY.IMPORT)
    ) {
      throw new BadRequestException("This connection does not support content import.");
    }

    const fields = adapter.definition.configuration?.fields ?? [];
    const credentialKeys = resolveCredentialKeys(
      adapter.definition.configuration ?? { type: "credentials", fields: [] },
      fields,
    );
    const credentials = parseConnectorCredentials(this.encryption.decrypt(row.encryptedCredentials));
    const accessToken =
      credentials.accessToken ?? credentials[credentialKeys[0] ?? ""] ?? "";
    if (!accessToken.trim()) {
      throw new BadRequestException("Stored connector credentials are missing or invalid.");
    }

    return { connectorId: row.connectorId, accessToken: accessToken.trim() };
  }

  private async loadActiveConnection(connectionId: string): Promise<ConnectorConnectionRow> {
    const [row] = await this.repo.db
      .select()
      .from(connectorConnections)
      .where(
        this.repo.scope(
          connectorConnections,
          eq(connectorConnections.id, connectionId),
        ),
      )
      .limit(1);

    if (!row || !row.isConnected) {
      throw new NotFoundException(`Connection "${connectionId}" not found.`);
    }
    return row;
  }
}
