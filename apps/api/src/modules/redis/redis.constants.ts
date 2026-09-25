/** Injection token for the shared ioredis client. Kept in its own file so the
 * module and service can both import it without a circular dependency (TDZ). */
export const REDIS_CLIENT = "REDIS_CLIENT";
