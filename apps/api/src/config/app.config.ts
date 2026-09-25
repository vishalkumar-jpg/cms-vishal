import { API_GLOBAL_PREFIX } from "@ob-cms/shared";
import { getOsEnv, getOsEnvOptional } from "./env.config";

/** Routes excluded from NestJS `setGlobalPrefix` (SEO + Swagger). Shared by main.ts and e2e setup. */
export const GLOBAL_PREFIX_EXCLUSIONS = ["sitemap.xml", "robots.txt"] as const;

export const appConfig = {
  port: +(getOsEnvOptional("API_PORT") ?? "3001"),
  workerPort: +(getOsEnvOptional("WORKER_PORT") ?? "3011"),
  environment: getOsEnv("ENVIRONMENT") || "local",
  isLocal: (getOsEnv("ENVIRONMENT") || "local") === "local",
  globalPrefix: getOsEnvOptional("GLOBAL_PREFIX") ?? API_GLOBAL_PREFIX,
  allowedOrigins: (getOsEnv("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  // TODO(W1): auth config (JWT secret/expiry, Auth0 adapter flag).
  auth0Enabled: getOsEnv("AUTH0_ENABLED") === "true",
};
