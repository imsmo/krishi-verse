// modules/ambassadors/gateway/http-doc-extraction.provider.ts
// Real s2s adapter to the internal ai-services doc-extraction endpoint (POST {base}/v1/doc-extraction).
// Constant shared-secret bearer (Law 11 — inference runs ONLY in the service tier). Resilience-wrapped
// (timeout+retry+breaker). On exhaustion it DEGRADES (empty draft, needsReview) so one slow/dead model tier can't
// hang the ambassador's flow or fabricate listing fields. The raw doc text crosses the wire for the inference but
// is never stored on our side; only pointers + the structured draft come back.
import { Logger } from '@nestjs/common';
import { ResilienceService } from '../../../core/resilience/resilience.service';
import { DocExtractionProvider, DocExtractionQuery, SuggestedListingDraft } from './doc-extraction.port';

const DEP = 'ai-doc-extraction';
const MODEL_CODE = 'doc_listing_extract';

export interface HttpDocExtractionConfig { baseUrl: string; sharedSecret: string; timeoutMs: number }

export class HttpDocExtractionProvider implements DocExtractionProvider {
  private readonly log = new Logger('DocExtraction');
  constructor(private readonly cfg: HttpDocExtractionConfig, private readonly resilience: ResilienceService) {}

  async suggest(q: DocExtractionQuery): Promise<SuggestedListingDraft> {
    const degraded: SuggestedListingDraft = { draft: {}, confidence: 0, needsReview: true, modelCode: MODEL_CODE, modelId: null, degraded: true };
    return this.resilience.run<SuggestedListingDraft>(DEP, async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs);
      try {
        const res = await fetch(`${this.cfg.baseUrl}/v1/doc-extraction`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${this.cfg.sharedSecret}`, accept: 'application/json' },
          body: JSON.stringify({ tenant_id: q.tenantId, doc_text: q.docText, locale: q.locale, doc_type: q.docType, media_ids: q.mediaIds.slice(0, 10) }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`ai-services responded ${res.status}`);
        const out = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const draft = (out.draft && typeof out.draft === 'object') ? (out.draft as Record<string, unknown>) : {};
        const confidence = typeof out.confidence === 'number' ? out.confidence : 0;
        const needsReview = out.needs_review === true || confidence <= 0;
        return { draft, confidence, needsReview, modelCode: MODEL_CODE, modelId: typeof out.model_id === 'string' ? out.model_id : null, degraded: false };
      } catch (e) {
        this.log.warn(`doc-extraction degraded: ${(e as Error)?.message ?? 'err'}`);
        return degraded;
      } finally {
        clearTimeout(t);
      }
    }, { fallback: () => degraded });
  }
}
