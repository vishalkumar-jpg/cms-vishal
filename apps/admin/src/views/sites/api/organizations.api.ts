import { request } from "@/services/AxiosService";

/**
 * Minimal org shape for the CreateSiteWizard's owner picker. The full row has
 * status/plan too, but the wizard only needs id + name (+ createdAt to default
 * to the oldest org — the seeded "officebeacon" org on this deployment).
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

/** `GET /api/organizations` — super_admin only (same role that can create sites). */
export const listOrganizationsRequest = (): Promise<Organization[]> =>
  request<Organization[]>({ url: "/organizations", method: "GET" });
