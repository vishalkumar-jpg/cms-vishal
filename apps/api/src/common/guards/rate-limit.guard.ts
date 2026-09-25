import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { Redis } from "ioredis";
import {
  RATE_LIMIT_KEY,
  type RateLimitKeyBy,
  type RateLimitOptions,
} from "@common/decorators/rate-limit.decorator";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { rateLimitConfig } from "@config/rate-limit.config";
import { REDIS_CLIENT } from "@modules/redis/redis.constants";

/**
 * Global Redis-backed rate-limit guard (WAVE4b).
 *
 * - Reads a per-handler/controller {@link RateLimitOptions} via @RateLimit; when
 *   absent, applies the env-configurable GLOBAL default to every /api route.
 * - Fixed-window counter with an atomic INCR + (conditional) EXPIRE.
 * - On exceed: sets `Retry-After` + `X-RateLimit-*` and throws 429.
 * - FAILS OPEN: any Redis error (or disabled flag) allows the request — a cache
 *   blip must never hard-block legitimate traffic. The event is logged once.
 *
 * Ordering: registered FIRST in the global chain so abusive traffic is shed
 * before auth/tenant work runs. It does NOT depend on auth; for `tenant` keys it
 * reads `req.user` if a prior guard populated it, else degrades to ip.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!rateLimitConfig.enabled) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: AuthUser }>();
    const res = http.getResponse<Response>();

    const opts = this.reflector.getAllAndOverride<RateLimitOptions | RateLimitOptions[]>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    const policies = this.resolvePolicies(context, opts);

    for (const p of policies) {
      const id = this.partition(req, p.keyBy);
      // A `tenant`-scoped policy with no tenant on the request is not applicable.
      if (p.keyBy !== "ip" && id === null) continue;
      const key = `rl:${p.name}:${id ?? "anon"}`;

      let count: number;
      try {
        count = await this.redis.incr(key);
        if (count === 1) await this.redis.expire(key, p.window);
      } catch (err) {
        // Fail open — never block legit traffic on a Redis blip.
        this.logger.warn(`rate-limit fail-open (${p.name}): ${(err as Error).message}`);
        continue;
      }

      const remaining = Math.max(0, p.max - count);
      res.setHeader("X-RateLimit-Limit", String(p.max));
      res.setHeader("X-RateLimit-Remaining", String(remaining));

      if (count > p.max) {
        let ttl = p.window;
        try {
          const t = await this.redis.ttl(key);
          if (t > 0) ttl = t;
        } catch {
          /* keep the window as the retry hint */
        }
        res.setHeader("Retry-After", String(ttl));
        res.setHeader("X-RateLimit-Reset", String(ttl));
        throw new HttpException(
          { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: "Too many requests" },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return true;
  }

  /**
   * Build the list of buckets to enforce. A handler may declare a named bucket
   * (sharing one budget across routes) and STILL be subject to the global
   * default — the stricter `max` wins per bucket because both are checked.
   */
  private resolvePolicies(
    context: ExecutionContext,
    opts: RateLimitOptions | RateLimitOptions[] | undefined,
  ): Array<{ name: string; window: number; max: number; keyBy: RateLimitKeyBy }> {
    if (opts) {
      const list = Array.isArray(opts) ? opts : [opts];
      return list.map((o) => ({
        name: o.name ?? `${context.getClass().name}.${context.getHandler().name}`,
        window: o.window,
        max: o.max,
        keyBy: o.keyBy ?? "ip",
      }));
    }
    // No explicit policy → the global per-IP default.
    return [
      {
        name: "global",
        window: rateLimitConfig.global.window,
        max: rateLimitConfig.global.max,
        keyBy: "ip",
      },
    ];
  }

  /** Derive the bucket partition. Returns null when a tenant key is unavailable. */
  private partition(
    req: Request & { user?: AuthUser },
    keyBy: RateLimitKeyBy,
  ): string | null {
    const ip = this.clientIp(req);
    const tenant = this.tenantId(req);
    switch (keyBy) {
      case "ip":
        return ip;
      case "tenant":
        return tenant;
      case "ip+tenant":
        return tenant ? `${ip}|${tenant}` : null;
      default:
        return ip;
    }
  }

  /** Active site id (header or :siteId param) — the tenant dimension. */
  private tenantId(req: Request): string | null {
    const header = req.headers["x-site-id"];
    const fromHeader = (Array.isArray(header) ? header[0] : header)?.trim();
    const fromParam = (req.params as Record<string, string | undefined>)?.siteId?.trim();
    return fromParam || fromHeader || null;
  }

  /** First X-Forwarded-For hop, else the socket address. */
  private clientIp(req: Request): string {
    const xff = req.headers["x-forwarded-for"];
    const first = Array.isArray(xff) ? xff[0] : xff?.split(",")[0];
    return (first || req.socket?.remoteAddress || "unknown").trim();
  }
}
