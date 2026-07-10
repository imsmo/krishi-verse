// core/jobs/scheduled-job.registry.ts · registry of cadence jobs, keyed by name. Modules register their
// own ScheduledJob at onModuleInit() — the SAME pattern OUTBOX_HANDLER_REGISTRY uses for outbox handlers
// (see communication.module.ts, payments.module.ts) — so ScheduledJobsRunner never needs to know which
// modules exist; it only drains whatever is registered by the time OnApplicationBootstrap fires.
import { Injectable } from '@nestjs/common';
import { ScheduledJob } from './scheduled-job';

export const SCHEDULED_JOB_REGISTRY = Symbol('SCHEDULED_JOB_REGISTRY');

@Injectable()
export class ScheduledJobRegistry {
  private readonly byName = new Map<string, ScheduledJob>();

  register(job: ScheduledJob): void {
    if (this.byName.has(job.name)) throw new Error(`ScheduledJobRegistry: duplicate job name "${job.name}"`);
    this.byName.set(job.name, job);
  }

  list(): ScheduledJob[] { return [...this.byName.values()]; }
  get size(): number { return this.byName.size; }
}
