import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import responseUtils from "@utils/response.utils";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "@common/decorators/current-user.decorator";
import { ConnectorsImportService } from "./connectors-import.service";
import { ConnectorsService } from "./connectors.service";
import { ImportRunsService } from "./import-runs.service";
import { HUBSPOT_IMPORT_SCOPES } from "@ob-cms/block-schema";
import { ConnectorImportRunRequestDto } from "./dto/connector-import.dto";
import { ConnectConnectorDto } from "./dto/connectors.dto";

/**
 * Generic connector lifecycle for the active site (X-Site-Id scoped).
 * Credentials are encrypted at rest and never returned in API responses.
 */
@ApiTags("connectors")
@Controller("connectors")
export class ConnectorsController {
  constructor(
    private readonly connectors: ConnectorsService,
    private readonly connectorImport: ConnectorsImportService,
    private readonly importRuns: ImportRunsService,
  ) {}

  @Get()
  @Roles("site_admin")
  @ApiOperation({ summary: "List available connectors from the registry" })
  async list(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.connectors.listCatalog() });
  }

  @Get("import-runs")
  @Roles("site_admin")
  @ApiOperation({ summary: "List connector import runs for the site" })
  async listImportRuns(
    @Query("connectionId") connectionId: string | undefined,
    @Query("limit") limitRaw: string | undefined,
    @Res() res: Response,
  ): Promise<Response> {
    const limit =
      limitRaw !== undefined && limitRaw.trim() !== ""
        ? Number.parseInt(limitRaw, 10)
        : undefined;
    return responseUtils.success(res, {
      data: await this.importRuns.listRuns(connectionId?.trim() || undefined, limit),
    });
  }

  @Get("import-runs/:runId")
  @Roles("site_admin")
  @ApiOperation({ summary: "Get one import run" })
  async getImportRun(
    @Param("runId") runId: string,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, { data: await this.importRuns.getRun(runId) });
  }

  @Get("connections")
  @Roles("site_admin")
  @ApiOperation({ summary: "List all active connections for the site" })
  async listConnections(@Res() res: Response): Promise<Response> {
    return responseUtils.success(res, { data: await this.connectors.listConnections() });
  }

  @Get("connections/:connectionId")
  @Roles("site_admin")
  @ApiOperation({ summary: "Get safe details for one connection" })
  async getConnection(
    @Param("connectionId") connectionId: string,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.connectors.getConnection(connectionId),
    });
  }

  @Get("connections/:connectionId/import-preview")
  @Roles("site_admin")
  @ApiOperation({ summary: "Preview import inventory for a connected account" })
  async importPreview(
    @Param("connectionId") connectionId: string,
    @Query("scope") scope: string = HUBSPOT_IMPORT_SCOPES[0],
    @Res() res: Response,
  ): Promise<Response> {
    if (!HUBSPOT_IMPORT_SCOPES.includes(scope as (typeof HUBSPOT_IMPORT_SCOPES)[number])) {
      throw new BadRequestException(`scope must be one of: ${HUBSPOT_IMPORT_SCOPES.join(", ")}`);
    }
    const normalized = scope as (typeof HUBSPOT_IMPORT_SCOPES)[number];
    return responseUtils.success(res, {
      data: await this.connectorImport.previewImport(connectionId, normalized),
    });
  }

  @Post("connections/:connectionId/import")
  @Roles("site_admin")
  @ApiOperation({ summary: "Import content from a connected account" })
  async importRun(
    @Param("connectionId") connectionId: string,
    @Body() dto: ConnectorImportRunRequestDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.connectorImport.runImport(connectionId, dto.scope, user),
    });
  }

  @Post("connections/:connectionId/disconnect")
  @Roles("site_admin")
  @ApiOperation({ summary: "Disconnect one connection and clear stored credentials" })
  async disconnectConnection(
    @Param("connectionId") connectionId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.connectors.disconnectConnection(connectionId, user),
    });
  }

  @Get(":connectorId/connections")
  @Roles("site_admin")
  @ApiOperation({ summary: "List active connections for one connector" })
  async listConnectorConnections(
    @Param("connectorId") connectorId: string,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.connectors.listConnections(connectorId),
    });
  }

  @Post(":connectorId/connections")
  @Roles("site_admin")
  @ApiOperation({ summary: "Validate credentials and create a new connection" })
  async createConnection(
    @Param("connectorId") connectorId: string,
    @Body() dto: ConnectConnectorDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<Response> {
    return responseUtils.success(res, {
      data: await this.connectors.createConnection(connectorId, dto.configuration, user),
    });
  }
}
