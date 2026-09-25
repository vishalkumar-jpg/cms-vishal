import "reflect-metadata";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  type INestApplication,
} from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { Test, type TestingModule } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import request from "supertest";
import type { Request } from "express";
import { API_PREFIX, ROLE_CONTRIBUTOR, ROLE_SITE_ADMIN, SITE_ID_HEADER, type Role } from "@ob-cms/shared";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { RolesGuard } from "@common/guards/roles.guard";
import { TenantGuard } from "@common/guards/tenant.guard";
import { MembershipService } from "@common/tenancy/membership.service";
import { TenantContext } from "@common/tenancy/tenant-context";
import { HUBSPOT_CONNECTOR_ID } from "@ob-cms/block-schema";
import { ConnectorsController } from "../connectors.controller";
import { ConnectorsImportService } from "../connectors-import.service";
import { ConnectorsService } from "../connectors.service";
import { ImportRunsService } from "../import-runs.service";
import { appConfig } from "@config/app.config";

const sampleConnection = {
  connectionId: "ccn_test",
  connectorId: HUBSPOT_CONNECTOR_ID,
  connectorName: "HubSpot",
  category: "Website & Content",
  icon: "PlugZap",
  connected: true,
  accountId: "123456",
  accountLabel: "app.hubspot.com",
  credentialHint: "pat-…abc1",
  connectedAt: "2026-03-01T12:00:00.000Z",
  lastValidatedAt: "2026-03-01T12:00:00.000Z",
  metadata: { portalId: "123456" },
};

@Injectable()
class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const userId = req.headers["x-test-user-id"];
    if (typeof userId !== "string" || !userId) {
      throw new UnauthorizedException("Authentication required");
    }

    req.user = {
      userId,
      email: String(req.headers["x-test-user-email"] ?? "test@test.local"),
      isPlatformAdmin: req.headers["x-test-platform-admin"] === "true",
    };
    return true;
  }
}

function createConnectorsServiceMock(): ConnectorsService {
  return {
    listCatalog: mock(async () => []),
    listConnections: mock(async () => []),
    getConnection: mock(async () => sampleConnection),
    createConnection: mock(async () => sampleConnection),
    disconnectConnection: mock(async () => ({ ...sampleConnection, connected: false })),
  } as unknown as ConnectorsService;
}

function createConnectorsImportServiceMock(): ConnectorsImportService {
  return {
    previewImport: mock(async () => ({
      scope: "published",
      pages: { total: 0, published: 0, unpublished: 0, toImport: 0 },
      posts: { total: 0, published: 0, unpublished: 0, toImport: 0 },
    })),
    runImport: mock(async () => ({
      runId: "imr_test",
      importedPages: 0,
      importedPosts: 0,
      skipped: [],
    })),
  } as unknown as ConnectorsImportService;
}

function createImportRunsServiceMock(): ImportRunsService {
  return {
    listRuns: mock(async () => []),
    getRun: mock(async () => ({
      runId: "imr_test",
      connectionId: "ccn_test",
      connectorId: HUBSPOT_CONNECTOR_ID,
      connectorName: "HubSpot",
      accountId: "123456",
      accountLabel: null,
      scope: "published",
      status: "succeeded",
      startedAt: "2026-03-01T12:00:00.000Z",
      completedAt: "2026-03-01T12:00:00.000Z",
      resultSummary: { importedPages: 0, importedPosts: 0, skipped: [] },
      errorMessage: null,
    })),
  } as unknown as ImportRunsService;
}

async function createConnectorsTestApp(
  membershipRole: Extract<Role, typeof ROLE_CONTRIBUTOR | typeof ROLE_SITE_ADMIN> | null,
): Promise<{ app: INestApplication; connectors: ConnectorsService }> {
  const connectors = createConnectorsServiceMock();
  const membership = {
    getRoleForSite: mock(async () => membershipRole),
  };

  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [ConnectorsController],
    providers: [
      { provide: ConnectorsService, useValue: connectors },
      { provide: ConnectorsImportService, useValue: createConnectorsImportServiceMock() },
      { provide: ImportRunsService, useValue: createImportRunsServiceMock() },
      Reflector,
      TenantContext,
      { provide: MembershipService, useValue: membership },
      { provide: APP_GUARD, useClass: TestAuthGuard },
      { provide: APP_GUARD, useClass: TenantGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix(appConfig.globalPrefix);
  await app.init();

  return { app, connectors };
}

describe("ConnectorsController authorization", () => {
  test("registers ConnectorsController", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ConnectorsController],
      providers: [
        { provide: ConnectorsService, useValue: createConnectorsServiceMock() },
        { provide: ConnectorsImportService, useValue: createConnectorsImportServiceMock() },
        { provide: ImportRunsService, useValue: createImportRunsServiceMock() },
      ],
    }).compile();

    const controller = moduleRef.get(ConnectorsController);
    expect(controller).toBeInstanceOf(ConnectorsController);
  });

  describe("site_admin guard", () => {
    let app: INestApplication | undefined;
    let connectors: ConnectorsService;

    beforeAll(async () => {
      ({ app, connectors } = await createConnectorsTestApp(ROLE_SITE_ADMIN));
    });

    afterAll(async () => {
      await app?.close();
    });

    test("allows site_admin to list connectors", async () => {
      const res = await request(app!.getHttpServer())
        .get(`${API_PREFIX}/connectors`)
        .set("x-test-user-id", "usr_admin")
        .set(SITE_ID_HEADER, "site_test");

      expect(res.status).toBe(200);
      expect(connectors.listCatalog).toHaveBeenCalled();
    });

    test("allows site_admin to list connections", async () => {
      const res = await request(app!.getHttpServer())
        .get(`${API_PREFIX}/connectors/connections`)
        .set("x-test-user-id", "usr_admin")
        .set(SITE_ID_HEADER, "site_test");

      expect(res.status).toBe(200);
      expect(connectors.listConnections).toHaveBeenCalled();
    });

    test("allows site_admin to list import runs with optional connectionId", async () => {
      const importRuns = app!.get(ImportRunsService);
      const res = await request(app!.getHttpServer())
        .get(`${API_PREFIX}/connectors/import-runs`)
        .query({ connectionId: "ccn_test", limit: "50" })
        .set("x-test-user-id", "usr_admin")
        .set(SITE_ID_HEADER, "site_test");

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(importRuns.listRuns).toHaveBeenCalledWith("ccn_test", 50);
    });

    test("rejects contributor role", async () => {
      const contributorApp = (await createConnectorsTestApp(ROLE_CONTRIBUTOR)).app;

      const res = await request(contributorApp.getHttpServer())
        .get(`${API_PREFIX}/connectors`)
        .set("x-test-user-id", "usr_contributor")
        .set(SITE_ID_HEADER, "site_test");

      expect(res.status).toBe(403);
      await contributorApp.close();
    });
  });
});
