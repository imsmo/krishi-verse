// modules/ai-governance/ai-governance.module.ts
// AI Governance (PRD §8.3) — the control plane for every consequential AI decision the platform makes:
//   • Model registry (ai_models, GLOBAL) — READ-ONLY browse here; lifecycle authoring is admin-api (Law 11).
//   • Inference audit log (ai_inferences, append-only, partitioned) — record every decision with a non-PII
//     projection + confidence; the explainability spine.
//   • Human-in-the-loop review queue (ai_review_queue) — low-confidence/flagged decisions go to AI Ops to
//     claim + resolve; the decision drives the originating module via the outbox.
//   • Content moderation reports (moderation_reports) — any user reports content; moderators action/dismiss.
// Money-free. Gated by the `ai_governance` flag (default OFF). Permissions: ai.review (ops) + content.moderate.
//
// SCOPE: inference recording + HITL review + moderation + read-only registry + drift-watch / fairness-audit
// worker jobs. DEFERRED: auto-recording of inferences from other modules' events (each module calls
// AiInferenceService.record directly when wired); model lifecycle writes (admin-api, Law 11).
import { Module } from '@nestjs/common';
import { ModelsController } from './controllers/v1/models.controller';
import { InferencesController } from './controllers/v1/inferences.controller';
import { ReviewQueueController } from './controllers/v1/review-queue.controller';
import { ModerationController } from './controllers/v1/moderation.controller';
import { AiModelService } from './services/ai-model.service';
import { AiInferenceService } from './services/ai-inference.service';
import { AiReviewService } from './services/ai-review.service';
import { ModerationService } from './services/moderation.service';
import { AiModelRepository } from './repositories/ai-model.repository';
import { AiInferenceRepository } from './repositories/ai-inference.repository';
import { AiReviewRepository } from './repositories/ai-review.repository';
import { ModerationReportRepository } from './repositories/moderation-report.repository';

@Module({
  controllers: [ModelsController, InferencesController, ReviewQueueController, ModerationController],
  providers: [AiModelService, AiInferenceService, AiReviewService, ModerationService,
    AiModelRepository, AiInferenceRepository, AiReviewRepository, ModerationReportRepository],
  exports: [AiInferenceService, AiReviewService, ModerationService],   // other modules use the service, never the repo
})
export class AiGovernanceModule {}
