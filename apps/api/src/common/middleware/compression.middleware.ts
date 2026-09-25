import { Buffer } from "node:buffer";
import { gzipSync, brotliCompressSync, constants as zlibConstants } from "node:zlib";
import type { NextFunction, Request, Response } from "express";

/**
 * Zero-dependency response compression (WAVE4b perf). Buffers JSON/text response
 * bodies and gzips/brotlis them when the client advertises support and the body
 * clears a min-size threshold. Implemented with Node's built-in `zlib` so no new
 * runtime dependency is introduced.
 *
 * Why a custom middleware (not the `compression` package): keeps the dependency
 * surface minimal and avoids a streaming layer the API doesn't need — responses
 * here are JSON envelopes and SEO docs, all small enough to compress synchronously.
 *
 * Skips: already-encoded responses, server-sent events, and tiny payloads.
 */
const MIN_BYTES = 1024;
const COMPRESSIBLE = /json|text|javascript|xml|html|svg/i;

export function compressionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const accept = String(req.headers["accept-encoding"] ?? "");
  const wantsBr = /\bbr\b/.test(accept);
  const wantsGzip = /\bgzip\b/.test(accept);
  if (!wantsBr && !wantsGzip) return next();

  const originalSend = res.send.bind(res);

  res.send = (body?: unknown): Response => {
    try {
      if (res.getHeader("Content-Encoding")) return originalSend(body);
      const type = String(res.getHeader("Content-Type") ?? "");
      if (type && !COMPRESSIBLE.test(type)) return originalSend(body);

      const raw =
        typeof body === "string"
          ? Buffer.from(body)
          : Buffer.isBuffer(body)
            ? body
            : body == null
              ? null
              : Buffer.from(JSON.stringify(body));

      if (!raw || raw.byteLength < MIN_BYTES) return originalSend(body);

      const encoding = wantsBr ? "br" : "gzip";
      const compressed =
        encoding === "br"
          ? brotliCompressSync(raw, {
              params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 },
            })
          : gzipSync(raw);

      res.setHeader("Content-Encoding", encoding);
      res.setHeader("Content-Length", compressed.byteLength);
      res.setHeader("Vary", "Accept-Encoding");
      return originalSend(compressed);
    } catch {
      // Any failure → fall back to the uncompressed body, never break the response.
      return originalSend(body);
    }
  };

  next();
}
