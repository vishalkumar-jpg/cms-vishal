import { SetMetadata } from "@nestjs/common";

/** Metadata key marking a route as unauthenticated (opts out of the global JWT guard). */
export const IS_PUBLIC_KEY = "isPublic";

/** Mark a handler/controller as public — the global JwtAuthGuard skips it. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
