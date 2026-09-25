import { API_PREFIX, type Role } from "@ob-cms/shared";
import { request } from "@/services/AxiosService";

/**
 * Invitations API. Site-scoped via the X-Site-Id header (Axios mutator), so the
 * management paths are relative `/invitations`. The public preview/accept paths
 * are token-resolved (no auth, no active site).
 */

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface Invitation {
  id: string;
  siteId: string;
  email: string;
  role: Role;
  status: InvitationStatus;
  token: string;
  acceptUrl: string;
  expiresAt: string;
  acceptedAt?: string | null;
  createdAt: string;
}

export interface CreateInvitationPayload {
  email: string;
  role: Role;
}

export interface InvitationPreview {
  siteName: string;
  email: string;
  role: Role;
  expired: boolean;
}

export interface AcceptInvitationPayload {
  name?: string;
  password?: string;
}

export const listInvitationsRequest = (): Promise<Invitation[]> =>
  request<Invitation[]>({ url: `${API_PREFIX}/invitations`, method: "GET" });

export const createInvitationRequest = (payload: CreateInvitationPayload): Promise<Invitation> =>
  request<Invitation>({ url: `${API_PREFIX}/invitations`, method: "POST", data: payload });

export const resendInvitationRequest = (id: string): Promise<Invitation> =>
  request<Invitation>({ url: `${API_PREFIX}/invitations/${id}/resend`, method: "POST" });

export const revokeInvitationRequest = (id: string): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>({ url: `${API_PREFIX}/invitations/${id}`, method: "DELETE" });

// -- public (token-resolved) --

export const previewInvitationRequest = (token: string): Promise<InvitationPreview> =>
  request<InvitationPreview>({ url: `${API_PREFIX}/public/invitations/${token}`, method: "GET" });

export const acceptInvitationRequest = (
  token: string,
  payload: AcceptInvitationPayload,
): Promise<{ ok: boolean }> =>
  request<{ ok: boolean }>({
    url: `${API_PREFIX}/public/invitations/${token}/accept`,
    method: "POST",
    data: payload,
  });
