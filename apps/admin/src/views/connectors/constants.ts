/** Human-readable labels for safe connector metadata keys returned by the API. */
export const CONNECTOR_METADATA_LABELS: Record<string, string> = {
  portalId: "Portal ID",
  hubId: "Hub ID",
  accountLabel: "Account",
};

export const CONNECTORS_PAGE_DESCRIPTION =
  "Manage external platform connections and import content into OfficeBeacon.";

export const ADD_CONNECTOR_BUTTON = "Add Connection";

export const ADD_CONNECTION_DIALOG_TITLE = "Add Connection";

export const CONNECTION_DETAILS_DIALOG_TITLE = "Connection details";

export const IMPORT_PAGES_POSTS_BUTTON = "Import content";

export const DISCONNECT_ACCOUNT_BUTTON = "Disconnect account";

export const CONNECTION_STATUS_CONNECTED = "Connected";

export const CONNECTION_STATUS_NOT_CONNECTED = "Not connected";

export const ADD_CONNECTION_DIALOG_DESCRIPTION =
  "Choose a platform to connect to OfficeBeacon.";

export const IMPORT_ACTIVITY_SECTION_TITLE = "Import activity";

export const IMPORT_RUN_STATUS_SUCCEEDED = "succeeded" as const;
export const IMPORT_RUN_STATUS_FAILED = "failed" as const;
export const IMPORT_RUN_STATUS_RUNNING = "running" as const;

/** Default page size when listing import runs from Admin (matches API default). */
export const CONNECTOR_IMPORT_RUNS_LIST_LIMIT = 50;

export const HUBSPOT_IMPORT_SCOPE_LABELS: Record<string, string> = {
  published: "Published only",
  all: "All content",
};

/** Short helper copy for the import scope picker (keys match `HUBSPOT_IMPORT_SCOPES`). */
export const HUBSPOT_IMPORT_SCOPE_DESCRIPTIONS: Record<string, string> = {
  published:
    "Import only HubSpot content in a published (PUBLISHED*) state. Imported items are published in OfficeBeacon.",
  all: "Import published and draft HubSpot content. PUBLISHED* items are published in OB; everything else stays draft.",
};
