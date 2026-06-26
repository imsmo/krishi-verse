// modules/ambassadors/gateway/noop-doc-extraction.provider.ts
// Degrade adapter, bound when ai-services is NOT configured (no AI_SERVICES_URL / shared secret). NEVER fabricates
// field values — returns an empty draft at confidence 0 + needsReview, so the ambassador falls back to manual
// entry. Keeps "no model tier → safe degrade, never a fake suggestion" true in local/dev and prod misconfig.
import { DocExtractionProvider, DocExtractionQuery, SuggestedListingDraft } from './doc-extraction.port';

export class NoopDocExtractionProvider implements DocExtractionProvider {
  async suggest(_q: DocExtractionQuery): Promise<SuggestedListingDraft> {
    return { draft: {}, confidence: 0, needsReview: true, modelCode: 'doc_listing_extract', modelId: null, degraded: true };
  }
}
