// modules/ambassadors/gateway/doc-extraction.provider.ts · binds DOC_EXTRACTION by config.
// ai-services configured (AI_SERVICES_URL + shared secret, reused from the assistant config) → resilience-wrapped
// s2s HTTP adapter; otherwise the noop/degrade adapter (always empty draft + needsReview — never fabricates).
// The feature itself is additionally gated by the `assisted_doc_prefill` flag at the route.
import { Provider } from '@nestjs/common';
import { AppConfig } from '../../../core/config/app-config';
import { ResilienceService } from '../../../core/resilience/resilience.service';
import { DOC_EXTRACTION } from './doc-extraction.port';
import { HttpDocExtractionProvider } from './http-doc-extraction.provider';
import { NoopDocExtractionProvider } from './noop-doc-extraction.provider';

export const docExtractionProvider: Provider = {
  provide: DOC_EXTRACTION,
  inject: [AppConfig, ResilienceService],
  useFactory: (config: AppConfig, resilience: ResilienceService) => {
    const a = config.assistant;   // reuse the ai-services base URL + shared secret
    if (a.enabled) return new HttpDocExtractionProvider({ baseUrl: a.baseUrl, sharedSecret: a.sharedSecret, timeoutMs: a.timeoutMs }, resilience);
    return new NoopDocExtractionProvider();
  },
};
