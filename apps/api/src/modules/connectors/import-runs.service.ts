import { Injectable, NotFoundException } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { getConnector } from "@ob-cms/block-schema";
import type { HubspotImportScope } from "@ob-cms/block-schema";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type { ConnectorConnectionRow } from "@database/schema/connector-connections.schema";
import {
  IMPORT_RUN_ITEM_ERROR_LENGTH,
  importRunItems,
  type ImportRunItemStatus,
  type ImportRunObEntityType,
} from "@database/schema/import-run-items.schema";
import {
  IMPORT_RUN_ERROR_LENGTH,
  importRuns,
  type ImportRunResultSummary,
  type ImportRunRow,
} from "@database/schema/import-runs.schema";
import { buildHubspotImportCorrelationKey } from "./connectors.constants";
import type { ImportSummary } from "@modules/hubspot-import/hubspot-import.service";
import type { ConnectorImportRunResponseDto, ImportRunDto } from "./dto/import-runs.dto";
import {
  IMPORT_RUNS_LIST_DEFAULT_LIMIT,
  IMPORT_RUNS_LIST_MAX_LIMIT,
} from "./connectors.constants";

const clampImportRunsLimit = (raw: number | undefined): number => {
  if (raw === undefined || Number.isNaN(raw) || raw < 1) {
    return IMPORT_RUNS_LIST_DEFAULT_LIMIT;
  }
  return Math.min(Math.trunc(raw), IMPORT_RUNS_LIST_MAX_LIMIT);
};

@Injectable()
export class ImportRunsService {
  constructor(private readonly repo: ScopedRepository) {}

  async listRuns(connectionId?: string, limitRaw?: number): Promise<ImportRunDto[]> {
    const limit = clampImportRunsLimit(limitRaw);
    const conditions = connectionId
      ? eq(importRuns.connectionId, connectionId)
      : undefined;

    const rows = await this.repo.db
      .select()
      .from(importRuns)
      .where(this.repo.scope(importRuns, conditions))
      .orderBy(desc(importRuns.createdAt))
      .limit(limit);

    return rows.map((row) => this.toDto(row));
  }

  async getRun(runId: string): Promise<ImportRunDto> {
    const row = await this.findRunRow(runId);
    if (!row) {
      throw new NotFoundException(`Import run "${runId}" not found.`);
    }
    return this.toDto(row);
  }

  async startRun(
    connection: ConnectorConnectionRow,
    scope: HubspotImportScope,
    actor: AuthUser,
  ): Promise<ImportRunRow> {
    const metadata = (connection.metadata ?? {}) as Record<string, unknown>;
    const accountLabel =
      typeof metadata.accountLabel === "string" ? metadata.accountLabel.trim() : null;
    const now = new Date();

    const [row] = await this.repo.db
      .insert(importRuns)
      .values({
        ...this.repo.insertDefaults(),
        siteId: this.repo.siteId,
        connectionId: connection.id,
        connectorId: connection.connectorId,
        accountId: connection.accountId,
        accountLabel: accountLabel || null,
        scope,
        status: "running",
        startedAt: now,
        correlationKey: buildHubspotImportCorrelationKey(connection.id, scope),
        createdBy: actor.userId,
        updatedBy: actor.userId,
      })
      .returning();

    return row;
  }

  async completeRunSuccess(
    runId: string,
    summary: ImportSummary,
    actor: AuthUser,
  ): Promise<ConnectorImportRunResponseDto> {
    const resultSummary: ImportRunResultSummary = {
      importedPages: summary.importedPages,
      importedPosts: summary.importedPosts,
      updatedPages: summary.updatedPages ?? 0,
      updatedPosts: summary.updatedPosts ?? 0,
      skipped: summary.skipped,
    };
    const now = new Date();

    const [row] = await this.repo.db
      .update(importRuns)
      .set({
        status: "succeeded",
        completedAt: now,
        resultSummary,
        errorMessage: null,
        updatedBy: actor.userId,
      })
      .where(
        this.repo.scope(importRuns, eq(importRuns.id, runId)),
      )
      .returning();

    if (!row) {
      throw new NotFoundException(`Import run "${runId}" not found.`);
    }

    return { runId: row.id, ...resultSummary };
  }

  async recordRunItem(input: {
    runId: string;
    hubspotHsId: string;
    hubspotKind: string;
    status: ImportRunItemStatus;
    obEntityType?: ImportRunObEntityType;
    obEntityId?: string;
    error?: string;
    actor: AuthUser;
  }): Promise<void> {
    const now = new Date();
    await this.repo.db.insert(importRunItems).values({
      ...this.repo.insertDefaults(),
      runId: input.runId,
      hubspotHsId: input.hubspotHsId,
      hubspotKind: input.hubspotKind,
      status: input.status,
      obEntityType: input.obEntityType ?? null,
      obEntityId: input.obEntityId ?? null,
      error: input.error?.slice(0, IMPORT_RUN_ITEM_ERROR_LENGTH) ?? null,
      finishedAt: now,
      createdBy: input.actor.userId,
      updatedBy: input.actor.userId,
    });
  }

  async completeRunFailure(
    runId: string,
    errorMessage: string,
    actor: AuthUser,
  ): Promise<void> {
    await this.repo.db
      .update(importRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage: errorMessage.slice(0, IMPORT_RUN_ERROR_LENGTH),
        updatedBy: actor.userId,
      })
      .where(
        this.repo.scope(importRuns, eq(importRuns.id, runId)),
      );
  }

  private async findRunRow(runId: string): Promise<ImportRunRow | null> {
    const [row] = await this.repo.db
      .select()
      .from(importRuns)
      .where(this.repo.scope(importRuns, eq(importRuns.id, runId)))
      .limit(1);
    return row ?? null;
  }

  private toDto(row: ImportRunRow): ImportRunDto {
    const definition = getConnector(row.connectorId)?.definition;
    return {
      runId: row.id,
      connectionId: row.connectionId,
      connectorId: row.connectorId,
      connectorName: definition?.name ?? row.connectorId,
      accountId: row.accountId ?? null,
      accountLabel: row.accountLabel ?? null,
      scope: row.scope,
      status: row.status,
      startedAt: row.startedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      resultSummary: row.resultSummary ?? {
        importedPages: 0,
        importedPosts: 0,
        skipped: [],
      },
      errorMessage: row.errorMessage ?? null,
    };
  }
}
