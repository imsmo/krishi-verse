// modules/assistant/gateway/assistant-inference.provider.ts · binds ASSISTANT_INFERENCE by config.
// ai-services configured (AI_SERVICES_URL + shared secret) → resilience-wrapped s2s HTTP adapter; otherwise the
// noop/degrade adapter (always needs_review — never fabricates). Flipping the provider is config, not a rewrite.
import { Provider } from '@nestjs/common';
import { AppConfig } from '../../../core/config/app-config';
import { ResilienceService } from '../../../core/resilience/resilience.service';
import { ASSISTANT_INFERENCE } from './assistant-inference.port';
import { HttpAssistantInferenceProvider } from './http-assistant-inference.provider';
import { NoopAssistantInferenceProvider } from './noop-assistant-inference.provider';

export const assistantInferenceProvider: Provider = {
  provide: ASSISTANT_INFERENCE,
  inject: [AppConfig, ResilienceService],
  useFactory: (config: AppConfig, resilience: ResilienceService) => {
    const a = config.assistant;
    if (a.enabled) return new HttpAssistantInferenceProvider({ baseUrl: a.baseUrl, sharedSecret: a.sharedSecret, timeoutMs: a.timeoutMs }, resilience);
    return new NoopAssistantInferenceProvider();
  },
};
