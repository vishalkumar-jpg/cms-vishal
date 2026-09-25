-- SUBMISSIONS-INBOX — add a read/unread triage flag to form_submissions.
-- Independent of the CRM delivery `status` column: an editor marks a lead as
-- read/unread while triaging the inbox. Duplicate-safe (re-applying is a no-op).

ALTER TABLE "ob_cms"."form_submissions"
  ADD COLUMN IF NOT EXISTS "is_read" boolean NOT NULL DEFAULT false;
