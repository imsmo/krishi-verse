// modules/assistant/assistant.module.ts
// Governed farmer AI assistant (PRD §D / P1-13). A farmer asks a question; the orchestrator screens it for
// prompt-injection, enforces per-user cost/rate caps, calls the internal ai-services tier over s2s
// (resilience-wrapped), records the governed decision to the append-only ai_inferences, and returns a logged
// answer in the farmer's language. The model runs ONLY in the service tier (Law 11); without a provider key the
// call DEGRADES to a safe needs_review message — never a fabricated answer (Law 12). Gated by the `ai_assistant`
// feature flag (default OFF). No new migration (logs to the existing 0013 ai_inferences; RLS already applies).
import { Module } from '@nestjs/common';
import { AppConfig } from '../../core/config/app-config';
import { AssistantController } from './controllers/v1/assistant.controller';
import { AssistantService } from './services/assistant.service';
import { AssistantRepository } from './repositories/assistant.repository';
import { assistantInferenceProvider } from './gateway/assistant-inference.provider';
import { ASSISTANT_CAPS } from './domain/cost-cap';

@Module({
  controllers: [AssistantController],
  providers: [
    AssistantService,
    AssistantRepository,
    assistantInferenceProvider,
    { provide: ASSISTANT_CAPS, inject: [AppConfig], useFactory: (config: AppConfig) => ({ dailyCap: config.assistant.dailyCap, perMinuteCap: config.assistant.perMinuteCap }) },
  ],
  exports: [AssistantService],
})
export class AssistantModule {}
