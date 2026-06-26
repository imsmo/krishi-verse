// modules/ambassadors/gateway/doc-extraction.port.ts
// Port to the internal ai-services doc-extraction tier (POST {base}/v1/doc-extraction). ADVISORY only (Law 11 —
// the api tier owns the on-behalf consent gate + the ambassador's confirm; the model only SUGGESTS fields). The
// raw OCR'd document text is sent for the inference but is NEVER persisted here (only media pointers + the
// structured draft cross back). Adapters are resilience-wrapped and DEGRADE (empty draft, needsReview) rather
// than hang or fabricate (Law 12).
export const DOC_EXTRACTION = Symbol('DOC_EXTRACTION');

export interface DocExtractionQuery {
  tenantId: string | null;
  docText: string;            // transient (OCR'd/typed upstream); never persisted on our side
  locale: string;            // hi | en | gu
  docType: 'listing' | 'scheme';
  mediaIds: string[];        // pointers for the audit trail
}

export interface SuggestedListingDraft {
  draft: Record<string, unknown>;   // the model's normalised field suggestions (never auto-applied)
  confidence: number;
  needsReview: boolean;
  modelCode: string;
  modelId: string | null;
  degraded: boolean;
}

export interface DocExtractionProvider {
  suggest(q: DocExtractionQuery): Promise<SuggestedListingDraft>;
}
