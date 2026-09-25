import { boolean, index, jsonb, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";

/**
 * `mockCrmReceipts` (prefix `mcr`) — local-dev only sink for the mock CRM
 * receiver (`POST /api/dev/mock-crm`). Stores every payload the pipeline
 * delivers so the full forms→CRM loop is testable end-to-end without a real
 * CRM. NOT tenant-scoped (it is a global dev sink) and guarded to non-prod.
 *
 * `signatureValid` records whether the HMAC verified — the delivery worker must
 * always produce a valid signature.
 */
export const mockCrmReceipts = obCmsSchema.table(
  "mock_crm_receipts",
  {
    ...baseColumns("mcr"),
    siteId: varchar({ length: 50 }),
    formId: varchar({ length: 50 }),
    submissionId: varchar({ length: 50 }),
    idempotencyKey: varchar({ length: 60 }),
    signatureValid: boolean().notNull().default(false),
    payload: jsonb().notNull().default({}),
  },
  (t) => [index("mcr_submission_idx").on(t.submissionId)],
);

export type MockCrmReceiptRow = typeof mockCrmReceipts.$inferSelect;
export type NewMockCrmReceiptRow = typeof mockCrmReceipts.$inferInsert;
