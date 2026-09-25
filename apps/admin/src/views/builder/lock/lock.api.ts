import { request } from "@/services/AxiosService";

/** CONTENT-OPS advisory edit-lock: the entity kinds that can be locked. */
export type LockEntity = "pages" | "posts";

/** Lock state returned by the API (mirrors ContentLocksService.LockView). */
export interface LockView {
  locked: boolean;
  holder: {
    userId: string;
    userName: string;
    acquiredAt: string;
    heartbeatAt: string;
  } | null;
  mine: boolean;
}

/**
 * Raw content-lock API calls. Site-scoped via the X-Site-Id header. `entity` is
 * the URL segment ("pages" | "posts") so one client serves both builders.
 */
export const getLockRequest = (entity: LockEntity, id: string): Promise<LockView> =>
  request<LockView>({ url: `/${entity}/${id}/lock`, method: "GET" });

export const acquireLockRequest = (
  entity: LockEntity,
  id: string,
  takeOver = false,
): Promise<LockView> =>
  request<LockView>({ url: `/${entity}/${id}/lock`, method: "POST", data: { takeOver } });

export const releaseLockRequest = (entity: LockEntity, id: string): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>({ url: `/${entity}/${id}/lock`, method: "DELETE" });
