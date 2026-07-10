// modules/payments/jobs/wage-priority-lane.job.ts
// Worker job (kv_relay/kv_wallet): drains the WAGE priority lane FIRST — a labourer's earnings should
// reach their bank ahead of the bulk settlement queue. It opens a 'wage_lane' payout batch and claims
// only low-priority-number payouts (priority <= WAGE_LANE_PRIORITY — those promoted by the
// booking-clocked-out handler), then disburses each via the wallet boundary (PayoutBatchService →
// PayoutService.execute). Bounded per tick. Idempotent + safe: claiming uses FOR UPDATE SKIP LOCKED so
// it never races the general PayoutExecutionJob, and a payout already claimed by either is never
// double-disbursed (the gateway dedups on the payout idempotency key). NOT a DI provider — apps/worker
// instantiates it with the privileged Pool + the (DI-constructed) PayoutBatchService.
//
// S5 REVIEW P0 DISPOSITION — GA-DEFERRED (deliberately NOT wired into core/jobs/jobs.runner.ts):
// PayoutExecutionCadenceJob (payout-execution.cadence-job.ts), wired for the pilot, drives
// PayoutRepository.claimQueued, which claims with `ORDER BY priority ASC, created_at ASC` and NO
// priority filter — so wage-lane payouts (priority=WAGE_LANE_PRIORITY=10) are ALREADY claimed and
// disbursed ahead of default-priority (100) payouts by that job alone, every 5-minute tick, up to its
// batch limit. This job's only distinct value over that is a separate `payout_batches` bookkeeping
// envelope (`batchType: 'wage_lane'`) for reporting "what the wage lane settled this run" — not
// required for a wage payout to actually reach the bank. Revisit for GA if a dashboard needs wage-lane
// disbursement reported as its own auditable batch rather than interleaved with the general job's ticks.
import type { Pool } from 'pg';
import { PayoutBatchService, RunBatchResult } from '../services/payout-batch.service';
import { WAGE_LANE_PRIORITY } from '../domain/payout.state';

export class WagePriorityLaneJob {
  constructor(private readonly systemPool: Pool, private readonly batches: PayoutBatchService) {}

  async run(limit = 200): Promise<RunBatchResult> {
    return this.batches.runBatch(this.systemPool, { batchType: 'wage_lane', maxPriority: WAGE_LANE_PRIORITY, limit });
  }
}
