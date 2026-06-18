// modules/requirements/requirements.module.ts
// Reverse marketplace (M12): buyers POST demand (requirements); sellers QUOTE (requirement_responses);
// the buyer accepts a quote → the requirement is fulfilled and the order is created downstream (orders)
// via the outbox (requirements.quote_accepted → orders QuoteAcceptedHandler). Reads listing/seller via
// ListingService (Law 11). NO money here. Gated by the `requirements` feature flag (default OFF).
import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { RequirementsController } from './controllers/v1/requirements.controller';
import { ResponsesController } from './controllers/v1/responses.controller';
import { RequirementService } from './services/requirement.service';
import { RequirementResponseService } from './services/requirement-response.service';
import { RequirementRepository } from './repositories/requirement.repository';
import { RequirementResponseRepository } from './repositories/requirement-response.repository';

// The expiry worker job (jobs/expire-requirements.job.ts) is instantiated by apps/worker with a
// privileged kv_relay Pool — not a DI provider (it takes a Pool), mirroring the auction/offer jobs.
@Module({
  imports: [ListingsModule],
  controllers: [RequirementsController, ResponsesController],
  providers: [RequirementService, RequirementResponseService, RequirementRepository, RequirementResponseRepository],
  exports: [RequirementService, RequirementResponseService],
})
export class RequirementsModule {}
