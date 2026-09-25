/* eslint-disable @typescript-eslint/no-floating-promises */
import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { AppModule } from "@/app.module";
import { compressionMiddleware } from "@common/middleware/compression.middleware";
import { appConfig, GLOBAL_PREFIX_EXCLUSIONS } from "@config/app.config";
import { assertRequiredEnv } from "@config/env.config";
import { initKsuid } from "@utils/ksuid.utils";

async function bootstrap(): Promise<void> {
  // Fail-fast env validation (WAVE4b): required secrets/URLs are present and
  // well-shaped before we open a port, with a clear error if not.
  assertRequiredEnv();

  // Pre-warm the ESM-only KSUID generator so drizzle's sync id $defaultFn works.
  await initKsuid();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Page layouts and POC imports are large JSON (serialized block trees), so raise
  // the body-parser limit well above the 100kb default. rawBody capture (for HMAC
  // webhook verification) is preserved because `rawBody: true` was set above.
  app.useBodyParser("json", { limit: "10mb" });
  app.useBodyParser("urlencoded", { limit: "10mb", extended: true });

  // Public, host-resolved SEO routes live at the conventional root, not /api.
  app.setGlobalPrefix(appConfig.globalPrefix, {
    exclude: [...GLOBAL_PREFIX_EXCLUSIONS],
  });

  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }),
  );

  // Hardened security headers (WAVE4b). The CSP is API-appropriate and still
  // permits the self-hosted Swagger UI at /docs. HSTS only meaningfully applies
  // over TLS (prod/staging); frameguard + noSniff + a tight referrer policy
  // round out the defaults. crossOriginResourcePolicy is relaxed to allow the
  // admin SPA (a different origin) to read JSON responses.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          // Swagger UI bundles inline styles/scripts; scope them to the doc page.
          "script-src": ["'self'", "'unsafe-inline'"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "img-src": ["'self'", "data:", "https:"],
          "connect-src": ["'self'"],
          "frame-ancestors": ["'none'"],
          "object-src": ["'none'"],
          "base-uri": ["'self'"],
          "upgrade-insecure-requests": appConfig.isLocal ? null : [],
        },
      },
      hsts: appConfig.isLocal
        ? false
        : { maxAge: 63072000, includeSubDomains: true, preload: true },
      frameguard: { action: "deny" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(cookieParser());
  app.use(compressionMiddleware);
  app.disable("x-powered-by");

  app.enableCors({
    credentials: true,
    origin: appConfig.allowedOrigins.length ? appConfig.allowedOrigins : true,
    // Allow the SPA to send the CSRF double-submit header on mutations.
    allowedHeaders: ["Content-Type", "Authorization", "X-Site-Id", "X-CSRF-Token"],
    exposedHeaders: ["Retry-After", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
  });

  app.enableShutdownHooks();

  // Swagger — serves the OpenAPI doc at /docs-json (Orval SDK source for admin).
  const swaggerConfig = new DocumentBuilder()
    .setTitle("OB-CMS API")
    .setDescription("Multi-tenant CMS API")
    .setVersion("0.0.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document, { jsonDocumentUrl: "docs-json" });

  await app.listen(appConfig.port);
  // eslint-disable-next-line no-console
  console.log(`🚀 OB-CMS API on http://localhost:${appConfig.port}/${appConfig.globalPrefix}`);
}
bootstrap();
