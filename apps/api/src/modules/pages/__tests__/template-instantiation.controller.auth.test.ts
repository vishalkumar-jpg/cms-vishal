import "reflect-metadata";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ValidationPipe,
  type INestApplication,
} from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Request } from "express";
import request from "supertest";
import { SITE_ID_HEADER, API_PREFIX } from "@ob-cms/shared";
import type { PageRow } from "@database/schema";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { RolesGuard } from "@common/guards/roles.guard";
import { TenantGuard } from "@common/guards/tenant.guard";
import { MembershipService } from "@common/tenancy/membership.service";
import { TenantContext } from "@common/tenancy/tenant-context";
import { appConfig } from "@config/app.config";
import { PagesController } from "../pages.controller";
import { PagesService } from "../pages.service";
import { TemplateInstantiationService } from "../template-instantiation.service";

const createdPage = {
  id: "pag_created",
  siteId: "site_test",
  title: "Landing",
  slug: "landing",
  status: "draft",
} as PageRow;

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
      email: "test@example.com",
      isPlatformAdmin: false,
    };
    return true;
  }
}

async function createTestApp(
  membershipRole: "contributor" | null,
): Promise<{
  app: INestApplication;
  instantiation: TemplateInstantiationService;
}> {
  const pages = {};
  const instantiation = {
    instantiate: mock(async () => createdPage),
  };
  const membership = {
    getRoleForSite: mock(async () => membershipRole),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [PagesController],
    providers: [
      Reflector,
      TenantContext,
      { provide: PagesService, useValue: pages },
      { provide: TemplateInstantiationService, useValue: instantiation },
      { provide: MembershipService, useValue: membership },
      { provide: APP_GUARD, useClass: TestAuthGuard },
      { provide: APP_GUARD, useClass: TenantGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix(appConfig.globalPrefix);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.init();
  return {
    app,
    instantiation: instantiation as unknown as TemplateInstantiationService,
  };
}

const body = {
  title: "Landing",
  slug: "landing",
  templateKey: "tpl-test",
};

describe(`POST ${API_PREFIX}/pages/from-template authorization`, () => {
  describe("site contributor", () => {
    let app: INestApplication;
    let instantiation: TemplateInstantiationService;

    beforeAll(async () => {
      ({ app, instantiation } = await createTestApp("contributor"));
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(() => {
      (instantiation.instantiate as ReturnType<typeof mock>).mockClear();
    });

    test("creates a page for a contributor in the active site", async () => {
      const response = await request(app.getHttpServer())
        .post(`${API_PREFIX}/pages/from-template`)
        .set("x-test-user-id", "usr_contributor")
        .set(SITE_ID_HEADER, "site_test")
        .send(body);

      expect(response.status).toBe(201);
      expect(response.body.data).toEqual(createdPage);
      expect(instantiation.instantiate).toHaveBeenCalledTimes(1);
    });

    test("rejects unauthenticated requests", async () => {
      const response = await request(app.getHttpServer())
        .post(`${API_PREFIX}/pages/from-template`)
        .set(SITE_ID_HEADER, "site_test")
        .send(body);

      expect(response.status).toBe(401);
      expect(instantiation.instantiate).not.toHaveBeenCalled();
    });

    test("rejects requests without an active site", async () => {
      const response = await request(app.getHttpServer())
        .post(`${API_PREFIX}/pages/from-template`)
        .set("x-test-user-id", "usr_contributor")
        .send(body);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Active site required");
      expect(instantiation.instantiate).not.toHaveBeenCalled();
    });
  });

  test("rejects a request whose nested seo payload is invalid", async () => {
    const { app, instantiation } = await createTestApp("contributor");
    try {
      const response = await request(app.getHttpServer())
        .post(`${API_PREFIX}/pages/from-template`)
        .set("x-test-user-id", "usr_contributor")
        .set(SITE_ID_HEADER, "site_test")
        .send({ ...body, seo: { title: 123, noindex: "yes" } });

      expect(response.status).toBe(400);
      expect(instantiation.instantiate).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  test("rejects users who are not members of the active site", async () => {
    const { app, instantiation } = await createTestApp(null);
    try {
      const response = await request(app.getHttpServer())
        .post(`${API_PREFIX}/pages/from-template`)
        .set("x-test-user-id", "usr_outsider")
        .set(SITE_ID_HEADER, "site_other")
        .send(body);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("not a member");
      expect(instantiation.instantiate).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
