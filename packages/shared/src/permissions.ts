import { z } from "zod";
import { type Role } from "./roles";

/**
 * RBAC-2: Fine-grained permission catalog (ADDITIVE over the 4 built-in roles).
 *
 * A permission is a `<domain>.<action>` string. Custom roles are an arbitrary
 * subset of this catalog; the 4 built-in roles map to fixed subsets below so
 * their behaviour is unchanged. The `@Roles()` hierarchy is untouched — this
 * catalog powers the OPT-IN `@RequirePermissions()` gate + the admin UI.
 */

/** Canonical permission list, grouped by domain. Order = display order. */
export const PERMISSION_GROUPS = [
  {
    domain: "page",
    label: "Pages",
    permissions: [
      "page.view",
      "page.create",
      "page.edit",
      "page.publish",
      "page.delete",
    ],
  },
  {
    domain: "blog",
    label: "Blog",
    permissions: [
      "blog.view",
      "blog.create",
      "blog.edit",
      "blog.publish",
      "blog.delete",
    ],
  },
  {
    domain: "collection",
    label: "Collections",
    permissions: [
      "collection.view",
      "collection.create",
      "collection.edit",
      "collection.delete",
    ],
  },
  {
    domain: "media",
    label: "Media",
    permissions: ["media.view", "media.upload", "media.delete"],
  },
  {
    domain: "form",
    label: "Forms",
    permissions: ["form.view", "form.manage", "form.export"],
  },
  {
    domain: "member",
    label: "Members",
    permissions: ["member.view", "member.manage"],
  },
  {
    domain: "role",
    label: "Roles & permissions",
    permissions: ["role.view", "role.manage"],
  },
  {
    domain: "domain",
    label: "Domains",
    permissions: ["domain.view", "domain.manage"],
  },
  {
    domain: "settings",
    label: "Settings",
    permissions: ["settings.view", "settings.manage"],
  },
  {
    domain: "theme",
    label: "Theme",
    permissions: ["theme.view", "theme.manage"],
  },
  {
    domain: "redirect",
    label: "Redirects",
    permissions: ["redirect.view", "redirect.manage"],
  },
  {
    domain: "nav",
    label: "Navigation",
    permissions: ["nav.view", "nav.manage"],
  },
  {
    domain: "analytics",
    label: "Analytics",
    permissions: ["analytics.view"],
  },
  {
    domain: "audit",
    label: "Audit log",
    permissions: ["audit.view"],
  },
] as const;

/** Flat list of every permission string in the catalog. */
export const PERMISSIONS = PERMISSION_GROUPS.flatMap(
  (g) => g.permissions,
) as readonly string[];

export type Permission = (typeof PERMISSION_GROUPS)[number]["permissions"][number];

export const permissionSchema = z.enum(
  PERMISSIONS as unknown as [string, ...string[]],
);

export const isPermission = (value: string): value is Permission =>
  (PERMISSIONS as readonly string[]).includes(value);

/**
 * Built-in role → default permission set. This PRESERVES today's behaviour:
 *  - super_admin: everything.
 *  - site_admin: everything EXCEPT platform-only concerns (there are none in the
 *    site-scoped catalog, so site_admin also gets all — but role.manage etc. are
 *    still gated by the existing @Roles("site_admin") on those controllers).
 *  - editor: content domains incl. publish.
 *  - contributor: content domains WITHOUT publish/delete.
 *
 * Effective permissions for a member with a CUSTOM role are that role's set;
 * otherwise they are this built-in default. See PermissionService (api).
 */
const ALL = [...PERMISSIONS] as string[];

const CONTENT_VIEW_EDIT = [
  "page.view",
  "page.create",
  "page.edit",
  "blog.view",
  "blog.create",
  "blog.edit",
  "collection.view",
  "collection.create",
  "collection.edit",
  "media.view",
  "media.upload",
  "form.view",
  "nav.view",
  "theme.view",
  "settings.view",
];

const EDITOR_PERMS = [
  ...CONTENT_VIEW_EDIT,
  "page.publish",
  "page.delete",
  "blog.publish",
  "blog.delete",
  "collection.delete",
  "media.delete",
  "form.manage",
  "form.export",
  "nav.manage",
  "redirect.view",
  "redirect.manage",
  "member.view",
  "analytics.view",
];

export const BUILTIN_ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  super_admin: ALL,
  site_admin: ALL,
  editor: EDITOR_PERMS,
  contributor: CONTENT_VIEW_EDIT,
};

/** Effective permission set for a built-in role (defensive copy). */
export const permissionsForBuiltinRole = (role: Role): string[] => [
  ...BUILTIN_ROLE_PERMISSIONS[role],
];
