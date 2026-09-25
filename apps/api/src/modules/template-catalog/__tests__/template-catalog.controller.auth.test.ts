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
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import request from "supertest";
import type { Request } from "express";
import { SITE_ID_HEADER, API_PREFIX } from "@ob-cms/shared";
import type { TemplateCatalogEntry } from "@ob-cms/template-registry";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { RolesGuard } from "@common/guards/roles.guard";
import { TenantGuard } from "@common/guards/tenant.guard";
import { MembershipService } from "@common/tenancy/membership.service";
import { TenantContext } from "@common/tenancy/tenant-context";
import type { TemplateCatalogStorage } from "@ob-cms/template-registry";
import { TemplateCatalogController } from "../template-catalog.controller";
import { TemplateCatalogModule } from "../template-catalog.module";
import { TemplateCatalogRepository } from "../template-catalog.repository";
import { TemplateCatalogService } from "../template-catalog.service";
import { appConfig } from "@config/app.config";

const catalogEntry: TemplateCatalogEntry = {
  id: "tsk_home",
  templateKey: "tpl-homepage",
  displayName: "Homepage",
  description: "Primary marketing home",
  category: "marketing",
  supportedPageTypes: ["homepage"],
  tags: ["home"],
  version: "1.0.0",
  status: "published",
  createdAt: "2026-07-30T12:00:00.000Z",
  updatedAt: "2026-07-30T12:00:00.000Z",
};

/** Test-only auth guard — sets req.user from headers (mirrors JwtAuthGuard contract). */
@Injectable()
class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const userId = request.headers["x-test-user-id"];
    if (typeof userId !== "string" || !userId) {
      throw new UnauthorizedException("Authentication required");
    }

    request.user = {
      userId,
      email: String(request.headers["x-test-user-email"] ?? "test@test.local"),
      isPlatformAdmin: request.headers["x-test-platform-admin"] === "true",
    };
    return true;
  }
}

function createStorageMock(): TemplateCatalogStorage {
  return {
    list: mock(async () => [catalogEntry]),
    getById: mock(async () => catalogEntry),
    getByKey: mock(async () => catalogEntry),
  };
}

function createCatalogServiceMock(): TemplateCatalogService {
  return {
    list: mock(async () => [catalogEntry]),
    getById: mock(async () => catalogEntry),
    getByKey: mock(async () => catalogEntry),
  } as unknown as TemplateCatalogService;
}

async function createCatalogTestApp(
  membershipRole: "contributor" | null,
): Promise<{ app: INestApplication; catalog: TemplateCatalogService; moduleRef: TestingModule }> {
  const catalog = createCatalogServiceMock();
  const membership = {
    getRoleForSite: mock(async () => membershipRole),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [TemplateCatalogModule],
    providers: [
      Reflector,
      TenantContext,
      { provide: MembershipService, useValue: membership },
      { provide: APP_GUARD, useClass: TestAuthGuard },
      { provide: APP_GUARD, useClass: TenantGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  })
    .overrideProvider(TemplateCatalogRepository)
    .useValue(createStorageMock())
    .overrideProvider(TemplateCatalogService)
    .useValue(catalog)
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix(appConfig.globalPrefix);
  await app.init();

  return { app, catalog, moduleRef };
}

describe("TemplateCatalogController authorization", () => {
  test("registers TemplateCatalogController through TemplateCatalogModule", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TemplateCatalogModule],
    })
      .overrideProvider(TemplateCatalogRepository)
      .useValue(createStorageMock())
      .overrideProvider(TemplateCatalogService)
      .useValue(createCatalogServiceMock())
      .compile();

    const controller = moduleRef.get(TemplateCatalogController);
    expect(controller).toBeInstanceOf(TemplateCatalogController);
  });

  describe("guard chain", () => {
    let app: INestApplication | undefined;
    let catalog: TemplateCatalogService;

    beforeAll(async () => {
      ({ app, catalog } = await createCatalogTestApp("contributor"));
    });

    afterAll(async () => {
      await app?.close();
    });

    beforeEach(() => {
      (catalog.list as ReturnType<typeof mock>).mockClear();
    });

    test("allows platform admin without active site", async () => {
      const res = await request(app.getHttpServer())
        .get(`${API_PREFIX}/template-catalog`)
        .set("x-test-user-id", "usr_platform")
        .set("x-test-platform-admin", "true");

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([catalogEntry]);
      expect(catalog.list).toHaveBeenCalled();
    });

    test("allows site contributor with X-Site-Id", async () => {
      const res = await request(app.getHttpServer())
        .get(`${API_PREFIX}/template-catalog`)
        .set("x-test-user-id", "usr_contributor")
        .set(SITE_ID_HEADER, "site_test");

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([catalogEntry]);
    });

    test("rejects unauthenticated requests", async () => {
      const res = await request(app.getHttpServer()).get(`${API_PREFIX}/template-catalog`);

      expect(res.status).toBe(401);
      expect(catalog.list).not.toHaveBeenCalled();
    });

    test("rejects authenticated user without site membership context", async () => {
      const res = await request(app.getHttpServer())
        .get(`${API_PREFIX}/template-catalog`)
        .set("x-test-user-id", "usr_member");

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("Active site required");
      expect(catalog.list).not.toHaveBeenCalled();
    });
  });

  describe("non-member site access", () => {
    let app: INestApplication | undefined;
    let catalog: TemplateCatalogService;

    beforeAll(async () => {
      ({ app, catalog } = await createCatalogTestApp(null));
    });

    afterAll(async () => {
      await app?.close();
    });

    beforeEach(() => {
      (catalog.list as ReturnType<typeof mock>).mockClear();
    });

    test("rejects user who is not a member of the active site", async () => {
      const res = await request(app.getHttpServer())
        .get(`${API_PREFIX}/template-catalog`)
        .set("x-test-user-id", "usr_outsider")
        .set(SITE_ID_HEADER, "site_other");

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("not a member");
      expect(catalog.list).not.toHaveBeenCalled();
    });
  });
});
