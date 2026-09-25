# In-app Notifications

Header-bell notifications for OB-CMS, fed by events the platform already
produces (comments + editorial workflow + naive @mentions). New module:
`apps/api/src/modules/notifications/**`, registered in `app.module.ts`,
migration `0031_notifications.sql`.

## Schema — `ob_cms.notifications` (prefix `ntf`)

`notifications.schema.ts` + `baseColumns` (KSUID id, createdAt/updatedAt,
soft-delete, createdBy/updatedBy).

| column            | type          | notes |
|-------------------|---------------|-------|
| `siteId`          | varchar FK    | tenant scope (cascade on site delete) |
| `recipientUserId` | varchar       | the user who SEES it (one row per recipient) |
| `type`            | varchar(40)   | `comment.added` \| `comment.reply` \| `comment.mention` \| `review.requested` \| `review.approved` \| `review.rejected` |
| `title`           | varchar(300)  | bell headline |
| `body`            | varchar(2000) | preview / note (nullable) |
| `entityType`      | varchar(40)   | `page` \| `page_comment` |
| `entityId`        | varchar(50)   | source object id |
| `link`            | varchar(500)  | ready admin path, e.g. `/pages/pag_1#cmt_2` |
| `actorUserId`     | varchar(50)   | who caused it (nullable) |
| `readAt`          | timestamptz   | null ⇒ unread (drives the badge) |

Indexes: `(siteId, recipientUserId, createdAt)` for the list read,
`(siteId, recipientUserId, readAt)` for the unread count.

## Emit map (event → recipients)

Emits are **best-effort** (`void … .catch()`; the service also swallows its own
errors and self-suppresses actor == recipient). A notification failure never
breaks the source action.

| source (file)                              | event               | recipients |
|--------------------------------------------|---------------------|------------|
| `comments.service.ts` `create()`           | `comment.added`     | page author (`pages.createdBy`) + any `@name` mention |
| `comments.service.ts` `reply()`            | `comment.reply`     | page author + other thread participants + any `@name` mention |
| `comments.service.ts` (mention token)      | `comment.mention`   | each `@name` resolved to a system user |
| `pages.service.ts` `submitReview()`        | `review.requested`  | the assigned `reviewerId` |
| `pages.service.ts` `approve()`             | `review.approved`   | the author (`pages.createdBy`) |
| `pages.service.ts` `reject()`              | `review.rejected`   | the author (`pages.createdBy`) |

`NotificationsService.notify()` / `notifyMany()` mirror `WebhooksEmitter`: not
request-scoped, take `siteId`/recipient explicitly, dedupe + exclude the actor.

## Read model (current-user scoped)

Every read/write is ANDed with `recipientUserId == me` AND `siteId == active`, so
a user only ever sees / mutates their OWN notifications. Auth + `@Roles("contributor")`.

- `GET  /notifications?unread=true` → `{ items: NotificationView[], unreadCount }`
  (items enriched with `actorName`/`actorEmail`, newest first, limit 30)
- `POST /notifications/:id/read` → mark one read (scoped)
- `POST /notifications/read-all` → mark all my unread read

## Bell UI (admin)

- `components/layout/NotificationBell.tsx` — bell in `AppShell` header with an
  unread badge; a dropdown of recent notifications (title, actor, time,
  read/unread dot) with per-item **mark-read** on click + **mark-all-read** +
  click-through `navigate(link)` to the page/comment.
- `views/notifications/{notifications.api.ts,useNotifications.ts,Notifications.tsx}`
  — wrapped hooks (polls every 30s + refetch-on-focus), a full `/notifications`
  page, `ADMIN_QUERY_KEYS.NOTIFICATIONS`.
