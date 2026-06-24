// modules/buyer/buyer.module.ts
// Buyer-facing favourites: saved items (listings/sellers/products/…) + saved searches (re-runnable
// filters). Everything is OWNER-scoped (the caller's own userId, from the token) — a user can only ever
// read/write their own saves; RLS on saved_items/saved_searches (migration 0020) is the tenant backstop.
// No money, no state machine, no feature flag — a core buyer self-feature behind AuthGuard.
import { Module } from '@nestjs/common';
import { SavesController } from './controllers/v1/saves.controller';
import { SavedSearchesController } from './controllers/v1/saved-searches.controller';
import { SavedService } from './services/saved.service';
import { SavedItemRepository } from './repositories/saved-item.repository';
import { SavedSearchRepository } from './repositories/saved-search.repository';

@Module({
  controllers: [SavesController, SavedSearchesController],
  providers: [SavedService, SavedItemRepository, SavedSearchRepository],
  exports: [SavedService],
})
export class BuyerModule {}
