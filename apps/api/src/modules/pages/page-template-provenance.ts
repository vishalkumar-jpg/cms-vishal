/**
 * Display-only origin snapshot written at template instantiation.
 * Not accepted on CreatePageDto / UpdatePageDto.
 */
export type PageTemplateProvenance = {
  sourceTemplateId: string;
  sourceTemplateKey: string;
  sourceTemplateVersion: string;
  instantiatedAt: Date;
};

/** Connection-scoped HubSpot import source identity (internal create() only). */
export type HubspotPageSourceIdentity = {
  hubspotConnectionId: string;
  hubspotKind: string;
  hubspotHsId: string;
};

/** Optional internal create() options — provenance is instantiate-only. */
export type CreatePageOptions = {
  provenance?: PageTemplateProvenance;
  hubspotSourceIdentity?: HubspotPageSourceIdentity;
};

type ProvenanceSource = {
  sourceTemplateId: string | null;
  sourceTemplateKey: string | null;
  sourceTemplateVersion: string | null;
  instantiatedAt: Date | null;
};

/** Copy provenance columns when duplicating or translating a page. */
export function provenanceColumnsFrom(
  source: ProvenanceSource,
): {
  sourceTemplateId: string | null;
  sourceTemplateKey: string | null;
  sourceTemplateVersion: string | null;
  instantiatedAt: Date | null;
} {
  return {
    sourceTemplateId: source.sourceTemplateId,
    sourceTemplateKey: source.sourceTemplateKey,
    sourceTemplateVersion: source.sourceTemplateVersion,
    instantiatedAt: source.instantiatedAt,
  };
}
