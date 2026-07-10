// modules/payments/jobs/settlement-statements.cadence-job.ts
// KV-BL-P0-9-follow-on — wraps the existing (previously-unwired) SettlementStatementsJob as a
// `ScheduledJob` so `core/jobs/jobs.runner.ts` can run it on a nightly cadence inside apps/api. See
// `settlement-statements.job.ts` for the job itself (unchanged — this class only supplies the [from, to)
// window + wires it into the runner; nothing about the job's own logic/idempotency changes).
//
// WHY THIS IS PILOT-RELEVANT (not GA-deferred): settlement_statements backs the seller wallet-statement
// screen (Screen-Data-Catalog #21/59) and the direct-orders flow (payments/orders — always-ON core
// modules, unlike auctions/dairy/fintech which are OFF for the pilot) already writes settlement_lines
// per completed order via OrderCompletedHandler. Without this job those lines would accumulate forever
// and a seller's wallet-statement screen would show nothing — the domain logic already exists
// (SettlementStatementService.generate, idempotent per seller+period) and was simply never scheduled.
import { Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { ScheduledJob } from '../../../core/jobs/scheduled-job';
import { previousUtcDayWindow } from '../../../core/jobs/date-window';
import { SettlementLineRepository } from '../repositories/settlement-line.repository';
import { SettlementStatementService } from '../services/settlement-statement.service';
import { SettlementStatementsJob } from './settlement-statements.job';

@Injectable()
export class SettlementStatementsCadenceJob implements ScheduledJob {
  readonly name = 'settlement-statements';
  private readonly log = new Logger(SettlementStatementsCadenceJob.name);

  constructor(
    readonly intervalMs: number,
    private readonly lines: SettlementLineRepository,
    private readonly statements: SettlementStatementService,
  ) {}

  /** Generates yesterday's (UTC) settlement statements for every tenant/seller with un-statemented
   *  lines. `pool` is the runner's shared kv_relay (BYPASSRLS) pool — the same role
   *  `SettlementStatementsJob`'s `systemPool` parameter expects, so this is unchanged from how
   *  apps/worker would have driven it, just triggered from apps/api's own timer instead. */
  async run(pool: Pool): Promise<void> {
    const { from, to } = previousUtcDayWindow(new Date());
    const job = new SettlementStatementsJob(pool, this.lines, this.statements);
    const result = await job.run(from, to, 'system-scheduled-job');
    this.log.log(`settlement-statements cycle [${from}, ${to}): generated=${result.generated} skipped=${result.skipped} failed=${result.failed}`);
  }
}
