// apps/admin-api/src/modules/ai-models-ops/ai-models-ops.module.ts · the god-mode AI model registry module
// (Law 11). Owns the lifecycle WRITE path for the GLOBAL ai_models table (register/promote/retire + threshold
// tuning) plus fairness reporting. apps/api/modules/ai-governance holds the tenant-facing READ-ONLY mirror.
import { Module } from '@nestjs/common';
import { AiModelsOpsController } from './ai-models-ops.controller';
import { ModelRegistryService } from './services/model-registry.service';
import { ThresholdTuningService } from './services/threshold-tuning.service';
import { FairnessAuditReportsService } from './services/fairness-audit-reports.service';
import { AiModelRepository } from './repositories/ai-model.repository';

@Module({
  controllers: [AiModelsOpsController],
  providers: [ModelRegistryService, ThresholdTuningService, FairnessAuditReportsService, AiModelRepository],
})
export class AiModelsOpsModule {}
