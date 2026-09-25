# Editorial Workflow / Approvals (gap B14)

Adds a review/approval lifecycle to **pages** and **posts** on top of the
existing draft/publish model. Content now moves through an explicit
`workflowState` with reviewer assignment and submit / approve / reject / publish
actions. Both modules behave identically; "content" below means a page or a post.

## State machine

```
        submit-review (reviewerId?)        approve
 draft ──────────────────────────▶ in_review ─────────▶ approved
   ▲                                   │                    │
   │            reject (note)          │       publish      │  publish
   └───────────────────────────────────┘ ◀──────────── (also direct from draft/approved)
                                                              │
                                                              ▼
                                                          published
```

- `draft → in_review` — `POST :id/submit-review { reviewerId? }`. Only a `draft`
  may be submitted. Sets `reviewerId` (optional assignee), `submittedAt`, clears
  any prior `reviewNote`.
- `in_review → approved` — `POST :id/approve { note? }`. Records `reviewNote`
  (if given) + `reviewedAt`.
- `in_review → draft` — `POST :id/reject { note }`. `note` is **required**;
  stored in `reviewNote` and surfaced to the author. Sets `reviewedAt`.
- `* → published` — `POST :id/publish`. Allowed from `draft`/`approved`. **Blocked
  while `in_review`** (must be approved or rejected first). Publish stamps
  `workflowState = "published"` (and the legacy `status = "published"`).
- A rollback resets `workflowState` back to `draft`.

## Who can do what (per-site role hierarchy: super_admin ⊃ site_admin ⊃ editor ⊃ contributor)

| Action          | Endpoint                  | Min role      |
| --------------- | ------------------------- | ------------- |
| Submit a draft  | `POST :id/submit-review`  | `contributor` |
| Approve         | `POST :id/approve`        | `editor`      |
| Reject          | `POST :id/reject`         | `editor`      |
| Publish         | `POST :id/publish`        | `editor`      |

Contributors cannot publish directly (publish is `editor`+), so they go through
submit → (editor) approve → (editor) publish. Editors/admins keep publishing
directly from `draft`/`approved` — the workflow only *blocks* publishing content
that is actively `in_review`. A non-editor calling approve/reject gets 403 from
the RolesGuard.

Every transition emits an audit event (category `content`):
`page.submitted_for_review` / `page.approved` / `page.rejected` (and the
`post.*` equivalents), plus the existing `page.published` / `post.published`.

## New columns (pages + posts, migration `0013_editorial_workflow.sql`)

| Column           | Type                       | Notes                                             |
| ---------------- | -------------------------- | ------------------------------------------------- |
| `workflow_state` | `varchar(20)` NOT NULL     | `draft \| in_review \| approved \| published`; default `draft`. Backfilled from `status` (published→published, else draft). |
| `reviewer_id`    | `varchar(50)` → system_users | assignee, FK `ON DELETE set null`.              |
| `review_note`    | `varchar(1000)`            | last approve/reject note.                          |
| `submitted_at`   | `timestamptz`              | when submitted for review.                         |
| `reviewed_at`    | `timestamptz`              | when last approved/rejected.                       |

Indexes: `{pag,pst}_site_workflow_idx (site_id, workflow_state)` and
`{pag,pst}_site_reviewer_idx (site_id, reviewer_id)` back the review-queue
filters. Migration statements are all `IF NOT EXISTS` / duplicate-safe.

## Review-queue filters (list endpoints)

`GET /pages` and `GET /posts` accept:

- `?state=draft|in_review|approved|published` — filter by workflow state.
- `?assignedTo=me` — content where `reviewerId` = the current user (resolved
  server-side from the auth context). A specific `userId` may also be passed.

These compose with the existing `?status=`, `?q=`, and (blog) `?category` / `?tag`
filters. The admin Pages + Blog screens expose a **Workflow** state dropdown and a
**Review queue** toggle ("assigned to me"), show the state as a badge alongside
the reviewer/last note, and offer per-row Submit / Approve / Reject / Publish
actions (Publish disabled while in review; Approve/Reject shown to editors only).
