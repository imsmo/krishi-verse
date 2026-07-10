// modules/payments/jobs/payout-execution.cadence-job.ts
// S5 REVIEW P0 — wires the existing (previously-unwired) PayoutExecutionJob into
// `core/jobs/jobs.runner.ts` as a `ScheduledJob`, mirroring `SettlementStatementsCadenceJob`
// (modules/payments/jobs/settlement-statements.cadence-job.ts) exactly. See `payout-execution.job.ts`
// for the job itself (unchanged — this class only supplies the runner's pool + a bounded batch size,
// then wires it in; nothing about the job's own claim/execute/error-isolation logic changes).
//
// WHY THIS WAS THE P0: POST /v1/payouts (PayoutService.requestPayout) reserves the caller's wallet
// funds and inserts a 'queued' payout row — but nothing in apps/api or apps/worker ever called
// PayoutExecutionJob.run(). No worker-registry entry, no SCHEDULED_JOB_REGISTRY entry, no admin
// trigger. A queued payout sat forever: money already debited out of the user's wallet, with no path
// to actually reach their bank account. The domain logic already existed and was simply never
// scheduled — same shape of gap S4's SettlementStatementsCadenceJob closed for settlement statements.
//
// CADENCE: every 5 minutes by default (PAYOUT_EXECUTION_JOB_INTERVAL_MS), deliberately NOT the
// once/day settlement-statements/KYC-expiry-reminders default — a payout is a user-facing withdrawal
// whose funds are already reserved out of the wallet the moment it's queued; making a seller/labourer
// wait up to a day for money that's already left their visible balance is a support-ticket generator,
// not a reporting-cadence concern.
//
// NOT the per-tenant (KYC-expiry) driver pattern: PayoutRepository.claimQueued is a SINGLE cross-tenant
// `UPDATE payouts ... WHERE status='queued' ... RETURNING id, tenant_id` against the runner's shared
// kv_relay (BYPASSRLS) pool — there is no per-tenant RLS UnitOfWork call in the claim step (payouts is
// scanned cross-tenant in one query, the same shape as SettlementStatementsJob's un-statemented-lines
// scan), so no tenant-enumeration loop is needed here. Each CLAIMED payout's disbursement then goes
// through PayoutService.execute's own tenant-scoped UnitOfWork.run(tenantId, ...) — that per-payout
// tenant scoping is unchanged from the underlying job, not something this wrapper adds or needs to.
//
// ERROR ISOLATION (verified already present, not added by this wrapper): PayoutExecutionJob.run()
// already wraps each claimed payout's `this.payouts.execute(...)` in its own try/catch — one payout
// throwing (e.g. an ambiguous gateway timeout) increments `failed` and the loop continues to the next
// payout; it never batch-aborts. A payout that fails this way simply stays 'processing' for
// reconciliation/retry (never silently lost, never double-disbursed — the gateway dedups on the
// payout's idempotency key). A DEFINITIVE gateway rejection is handled inside PayoutService.execute
// itself: the payout is marked 'failed' with a `failure_code` and reversed (funds returned to the
// wallet) — that failure_code is what feeds the payouts API's locale-resolved `failureReasonLocalized`.
//
// GATEWAY SAFETY: the money-OUT gateway is selected once, in payments.module.ts's PAYOUT_GATEWAY
// factory — RazorpayX when RAZORPAYX_KEY_ID is configured, else the deterministic SandboxPayoutGateway
// (non-prod only; the factory THROWS at boot if NODE_ENV=production and RazorpayX isn't configured,
// backstopped by AppConfig.assertProductionSecurity's BANK_VAULT_KIND check). This cadence job never
// touches gateway selection — it only drives PayoutService.execute on a timer, so whichever gateway
// the module wired is whichever gateway every disbursement uses, in every environment.
//
// WAGE-PRIORITY LANE (WagePriorityLaneJob) — GA-DEFERRED, not wired here: PayoutRepository.claimQueued
// orders `ORDER BY priority ASC, created_at ASC` with NO priority filter, so wage-lane payouts
// (priority=WAGE_LANE_PRIORITY=10, promoted by BookingClockedOutHandler) are already claimed AND
// disbursed ahead of default-priority (100) payouts by THIS job, within its own batch limit, on every
// 5-minute tick — the general execution job alone already drains the priority queue in priority order.
// WagePriorityLaneJob's only DISTINCT value is a separate `payout_batches` bookkeeping envelope scoped
// to `batchType: 'wage_lane'` (an auditable "here's what the wage lane settled this run" report via
// PayoutBatchService.runBatch) — that reporting envelope is not required for a wage payout to actually
// reach the bank; money movement is identical either way. Deferred to GA: if a future need emerges to
// report on wage-lane disbursement runs separately from this job's ticks (e.g. a dashboard needing
// "wages settled today" as its own auditable batch rather than interleaved with settlement payouts),
// wire WagePriorityLaneJob as its own ScheduledJob at that time.
import { Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { ScheduledJob } from '../../../core/jobs/scheduled-job';
import { PayoutRepository } from '../repositories/payout.repository';
import { PayoutService } from '../services/payout.service';
import { PayoutExecutionJob } from './payout-execution.job';

@Injectable()
export class PayoutExecutionCadenceJob implements ScheduledJob {
  readonly name = 'payout-execution';
  private readonly log = new Logger(PayoutExecutionCadenceJob.name);

  constructor(
    readonly intervalMs: number,
    private readonly repo: PayoutRepository,
    private readonly payouts: PayoutService,
    private readonly batchSize = 100,
  ) {}

  /** `pool` is the runner's shared kv_relay (BYPASSRLS) pool — the same role PayoutExecutionJob's
   *  `systemPool` parameter expects, so this is unchanged from how apps/worker would have driven it,
   *  just triggered from apps/api's own timer instead. Bounded per tick by `batchSize`
   *  (PAYOUT_EXECUTION_JOB_BATCH_SIZE) so one slow tick can never claim an unbounded number of rows. */
  async run(pool: Pool): Promise<void> {
    const job = new PayoutExecutionJob(pool, this.repo, this.payouts);
    const result = await job.run(this.batchSize);
    this.log.log(`payout-execution cycle: claimed=${result.claimed} executed=${result.executed} failed=${result.failed}`);
  }
}
