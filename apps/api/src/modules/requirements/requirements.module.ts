// modules/requirements/requirements.module.ts
// Reverse marketplace (M12): buyers POST demand (requirements); sellers QUOTE (requirement_responses);
// the buyer accepts a quote → the requirement is fulfilled and the order is created downstream (orders)
// via the outbox (requirements.quote_accepted → orders QuoteAcceptedHandler). Reads listing/seller via
// ListingService (Law 11). NO money here. Gated by the `requirements` feature flag (default OFF).
import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { OUTBOX_HANDLER_REGISTRY } from '../../core/outbox/event-envelope';
import { OutboxHandlerRegistry } from '../../core/outbox/outbox.dispatcher';
import { ListingsModule } from '../listings/listings.module';
import { RequirementsController } from './controllers/v1/requirements.controller';
import { ResponsesController } from './controllers/v1/responses.controller';
import { RequirementService } from './services/requirement.service';
import { RequirementResponseService } from './services/requirement-response.service';
import { RequirementRepository } from './repositories/requirement.repository';
import { RequirementResponseRepository } from './repositories/requirement-response.repository';
import { ListingPublishedHandler } from './events/handlers/listing-published.handler';

// The expiry + match-notifications worker jobs (jobs/*.job.ts) are instantiated by apps/worker with a
// privileged kv_relay Pool — not DI providers (they take a Pool), mirroring the auction/offer jobs.
@Module({
  imports: [ListingsModule],
  controllers: [RequirementsController, ResponsesController],
  providers: [RequirementService, RequirementResponseService, RequirementRepository, RequirementResponseRepository, ListingPublishedHandler],
  exports: [RequirementService, RequirementResponseService],
})
export class RequirementsModule implements OnModuleInit {
  constructor(
    @Inject(OUTBOX_HANDLER_REGISTRY) private readonly registry: OutboxHandlerRegistry,
    private readonly listingPublished: ListingPublishedHandler,
  ) {}
  // nudge buyers with matching OPEN requirements when a listing is published (listing.published)
  onModuleInit(): void { this.registry.register(this.listingPublished); }
}
