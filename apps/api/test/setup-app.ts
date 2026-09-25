import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { AppModule } from "@/app.module";
import { appConfig, GLOBAL_PREFIX_EXCLUSIONS } from "@config/app.config";
import { initKsuid } from "@utils/ksuid.utils";

/** Boot the real app the same way main.ts does (sans listen) for e2e tests. */
export async function createTestApp(): Promise<INestApplication> {
  await initKsuid();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.setGlobalPrefix(appConfig.globalPrefix, {
    exclude: [...GLOBAL_PREFIX_EXCLUSIONS],
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.use(cookieParser());
  await app.init();
  return app;
}
