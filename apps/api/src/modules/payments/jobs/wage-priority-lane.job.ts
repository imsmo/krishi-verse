// modules/payments/jobs/wage-priority-lane.job.ts
// Worker job (kv_relay/kv_wallet): drains the WAGE priority lane FIRST — a labourer's earnings should
// reach their bank ahead of the bulk settlement queue. It opens a 'wage_lane' payout batch and claims
// only low-priority-number payouts (priority <= WAGE_LANE_PRIORITY — those promoted by the
// booking-clocked-out handler), then disburses each via the wallet boundary (PayoutBatchService →
// PayoutService.execute). Bounded per tick. Idempotent + safe: claiming uses FOR UPDATE SKIP LOCKED so
// it never races the general PayoutExecutionJob, and a payout already claimed by either is never
// double-disbursed (the gateway dedups on the payout idempotency key). NOT a DI provider — apps/worker
// instantiates it with the privileged Pool + the (DI-constructed) PayoutBatchService.
import type { Pool } from 'pg';
import { PayoutBatchService, RunBatchResult } from '../services/payout-batch.service';
import { WAGE_LANE_PRIORITY } from '../domain/payout.state';

export class WagePriorityLaneJob {
  constructor(private readonly systemPool: Pool, private readonly batches: PayoutBatchService) {}

  async run(limit = 200): Promise<RunBatchResult> {
    return this.batches.runBatch(this.systemPool, { batchType: 'wage_lane', maxPriority: WAGE_LANE_PRIORITY, limit });
  }
}
