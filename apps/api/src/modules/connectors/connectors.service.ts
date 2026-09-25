import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import {
  getConnector,
  listConnectors,
  normalizeConnectorConfiguration,
  pickCredentialHintSource,
  resolveCredentialKeys,
  serializeConnectorCredentials,
  stripSecretKeysFromMetadata,
  validateRequiredConfigurationFields,
} from "@ob-cms/block-schema";
import { AuditService } from "@common/audit/audit.service";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import {
  connectorConnections,
  type ConnectorConnectionRow,
} from "@database/schema/connector-connections.schema";
import { EncryptionService } from "@modules/ai/encryption.service";
import {
  CONNECTOR_AUDIT_ACTIONS,
  CONNECTOR_AUDIT_ENTITY_TYPE,
  CONNECTOR_CONNECTION_ACCOUNT_UNIQUE_INDEX,
  CONNECTOR_CREDENTIAL_MIN_LENGTH,
  POSTGRES_UNIQUE_VIOLATION_CODE,
} from "./connectors.constants";
import type {
  ConnectorCatalogItemDto,
  ConnectorConnectionDto,
} from "./dto/connectors.dto";

const isConnectorAccountUniqueViolation = (err: unknown): boolean =>
  typeof err === "object" &&
  err !== null &&
  "code" in err &&
  (err as { code: string }).code === POSTGRES_UNIQUE_VIOLATION_CODE &&
  "constraint" in err &&
  (err as { constraint: string }).constraint === CONNECTOR_CONNECTION_ACCOUNT_UNIQUE_INDEX;

/**
 * Generic connector connection lifecycle. Provider-specific validation lives in
 * block-schema adapters; encryption and persistence stay in this service.
 */
@Injectable()
export class ConnectorsService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
  ) {}

  async listCatalog(): Promise<ConnectorCatalogItemDto[]> {
    const rows = await this.findConnectedRows();
    const countByConnectorId = new Map<string, number>();
    for (const row of rows) {
      countByConnectorId.set(
        row.connectorId,
        (countByConnectorId.get(row.connectorId) ?? 0) + 1,
      );
    }

    return listConnectors().map((definition) => ({
      ...definition,
      connectionCount: countByConnectorId.get(definition.id) ?? 0,
    }));
  }

  async listConnections(connectorId?: string): Promise<ConnectorConnectionDto[]> {
    if (connectorId) {
      this.requireConnector(connectorId);
    }

    const rows = await this.findConnectedRows(connectorId);
    return rows.map((row) => this.toConnectionDto(row));
  }

  async getConnection(connectionId: string): Promise<ConnectorConnectionDto> {
    const row = await this.findConnectionRow(connectionId);
    if (!row || !row.isConnected) {
      throw new NotFoundException(`Connection "${connectionId}" not found.`);
    }
    return this.toConnectionDto(row);
  }

  async createConnection(
    connectorId: string,
    configurationInput: Record<string, unknown>,
    actor: AuthUser,
  ): Promise<ConnectorConnectionDto> {
    const adapter = this.requireConnector(connectorId);
    const connectorConfig = adapter.definition.configuration;
    if (!connectorConfig) {
      throw new BadRequestException("This connector does not support configuration yet.");
    }
    if (connectorConfig.type === "oauth") {
      throw new BadRequestException("OAuth connectors are not enabled yet.");
    }

    const fields = connectorConfig.fields ?? [];
    const configuration = normalizeConnectorConfiguration(configurationInput);

    try {
      validateRequiredConfigurationFields(configuration, fields);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connector configuration is invalid.";
      throw new BadRequestException(message);
    }

    const credentialKeys = resolveCredentialKeys(connectorConfig, fields);
    const serializedCredentials = serializeConnectorCredentials(configuration, credentialKeys);
    if (serializedCredentials.length < CONNECTOR_CREDENTIAL_MIN_LENGTH) {
      throw new BadRequestException("Connector credentials are too short.");
    }

    let validation;
    try {
      validation = await adapter.validate(configuration);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connector validation failed.";
      throw new BadRequestException(message);
    }

    try {
      adapter.assertAllowed?.(validation);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connector account is not allowed.";
      throw new BadRequestException(message);
    }

    const duplicateAccountMessage = `This ${adapter.definition.name} account is already connected for this site.`;

    const existing = await this.findActiveByAccount(connectorId, validation.accountId);
    if (existing) {
      throw new ConflictException(duplicateAccountMessage);
    }

    const encryptedCredentials = this.encryption.encrypt(serializedCredentials);
    const credentialHint = this.encryption.mask(
      pickCredentialHintSource(configuration, fields, credentialKeys),
    );
    const metadata = stripSecretKeysFromMetadata(
      validation.metadata ?? {},
      credentialKeys,
    );
    const now = new Date();

    let row: ConnectorConnectionRow;
    try {
      row = await this.repo.db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(connectorConnections)
          .values({
            ...this.repo.insertDefaults(),
            siteId: this.repo.siteId,
            connectorId,
            accountId: validation.accountId,
            encryptedCredentials,
            credentialHint,
            metadata,
            isConnected: true,
            connectedAt: now,
            lastValidatedAt: now,
            createdBy: actor.userId,
            updatedBy: actor.userId,
          })
          .returning();

        await this.recordAudit(
          actor,
          CONNECTOR_AUDIT_ACTIONS.CONNECTED,
          {
            connectorId,
            connectionId: inserted.id,
            accountId: validation.accountId,
          },
          tx,
        );

        return inserted;
      });
    } catch (err) {
      if (isConnectorAccountUniqueViolation(err)) {
        throw new ConflictException(duplicateAccountMessage);
      }
      throw err;
    }

    return this.toConnectionDto(row);
  }

  async disconnectConnection(
    connectionId: string,
    actor: AuthUser,
  ): Promise<ConnectorConnectionDto> {
    const existing = await this.findConnectionRow(connectionId);
    if (!existing || !existing.isConnected) {
      throw new NotFoundException(`Connection "${connectionId}" not found.`);
    }

    await this.repo.db
      .update(connectorConnections)
      .set({
        isConnected: false,
        encryptedCredentials: "",
        credentialHint: "",
        deletedAt: new Date(),
        updatedBy: actor.userId,
      })
      .where(
        this.repo.scope(
          connectorConnections,
          eq(connectorConnections.id, existing.id),
        ),
      );

    await this.recordAudit(actor, CONNECTOR_AUDIT_ACTIONS.DISCONNECTED, {
      connectorId: existing.connectorId,
      connectionId: existing.id,
      accountId: existing.accountId,
    });

    return this.toConnectionDto({
      ...existing,
      isConnected: false,
      encryptedCredentials: "",
      credentialHint: "",
    });
  }

  private requireConnector(connectorId: string) {
    const adapter = getConnector(connectorId);
    if (!adapter) {
      throw new NotFoundException(`Unknown connector "${connectorId}".`);
    }
    return adapter;
  }

  private async findConnectionRow(
    connectionId: string,
  ): Promise<ConnectorConnectionRow | null> {
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
    return row ?? null;
  }

  private async findActiveByAccount(
    connectorId: string,
    accountId: string,
  ): Promise<ConnectorConnectionRow | null> {
    const [row] = await this.repo.db
      .select()
      .from(connectorConnections)
      .where(
        this.repo.scope(
          connectorConnections,
          and(
            eq(connectorConnections.connectorId, connectorId),
            eq(connectorConnections.accountId, accountId),
            eq(connectorConnections.isConnected, true),
          ),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async findConnectedRows(
    connectorId?: string,
  ): Promise<ConnectorConnectionRow[]> {
    const conditions = [eq(connectorConnections.isConnected, true)];
    if (connectorId) {
      conditions.push(eq(connectorConnections.connectorId, connectorId));
    }

    return this.repo.db
      .select()
      .from(connectorConnections)
      .where(
        this.repo.scope(
          connectorConnections,
          conditions.length === 1 ? conditions[0] : and(...conditions),
        ),
      );
  }

  private toConnectionDto(row: ConnectorConnectionRow): ConnectorConnectionDto {
    const definition = getConnector(row.connectorId)?.definition;
    const credentialKeys = definition?.configuration?.credentialKeys ?? [];
    const metadata = stripSecretKeysFromMetadata(
      (row.metadata ?? {}) as Record<string, unknown>,
      credentialKeys,
    );
    const accountLabel =
      typeof metadata.accountLabel === "string" && metadata.accountLabel.trim()
        ? metadata.accountLabel.trim()
        : null;

    return {
      connectionId: row.id,
      connectorId: row.connectorId,
      connectorName: definition?.name ?? row.connectorId,
      category: definition?.category,
      icon: definition?.icon ?? "PlugZap",
      connected: row.isConnected,
      accountId: row.accountId ?? null,
      accountLabel,
      credentialHint: row.credentialHint || null,
      connectedAt: row.connectedAt?.toISOString() ?? null,
      lastValidatedAt: row.lastValidatedAt?.toISOString() ?? null,
      metadata,
    };
  }

  private async recordAudit(
    actor: AuthUser,
    action: string,
    metadata: Record<string, unknown>,
    tx?: Parameters<AuditService["record"]>[1],
  ): Promise<void> {
    const connectionId =
      typeof metadata.connectionId === "string" ? metadata.connectionId : undefined;

    await this.audit.record(
      {
        siteId: this.repo.siteId,
        actorId: actor.userId,
        action,
        category: "content",
        entityType: CONNECTOR_AUDIT_ENTITY_TYPE,
        entityId: connectionId ?? String(metadata.connectorId ?? "connector"),
        metadata,
      },
      tx,
    );
  }
}
