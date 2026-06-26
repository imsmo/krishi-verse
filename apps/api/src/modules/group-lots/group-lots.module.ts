// modules/group-lots/group-lots.module.ts
// Group lots (PRD §7.7): FPO/coordinator POOLING. A coordinator opens a lot for a product + target quantity,
// records farmer pledges (running total, deadline-gated), marks it ready, and after the pooled sale SETTLES —
// computing each pledger's proportional share of the net proceeds (gross − coordination fee bps), float-free +
// zero-loss (Law 2). Built on the 0005 group_lots + group_lot_pledges tables (RLS auto-applied by 0014).
// Gated by the `group_lots` feature flag (default OFF) + the `group_lot.coordinate` permission.
//
// SCOPE (this build): create / list / detail / pledge / ready / cancel / settle (proportional share RECORD).
// DEFERRED (flagged): linking a ready lot to a sale `listing` (listings module owns group_lot_id) and the actual
// DISBURSEMENT of each share to the farmer's wallet — settle records the breakdown; the payout rides the
// payments/wallet path (no money is moved here, honouring Law 2).
import { Module } from '@nestjs/common';
import { GroupLotsController } from './controllers/v1/group-lots.controller';
import { GroupLotService } from './services/group-lot.service';
import { GroupLotRepository } from './repositories/group-lot.repository';

@Module({
  controllers: [GroupLotsController],
  providers: [GroupLotService, GroupLotRepository],
  exports: [GroupLotService],
})
export class GroupLotsModule {}
