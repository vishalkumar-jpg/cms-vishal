/** Connection-scoped HubSpot import source identity (internal create() only). */
export type HubspotPostSourceIdentity = {
  hubspotConnectionId: string;
  hubspotKind: string;
  hubspotHsId: string;
};

/** Optional internal create() options — not exposed on CreatePostDto. */
export type CreatePostOptions = {
  hubspotSourceIdentity?: HubspotPostSourceIdentity;
};
