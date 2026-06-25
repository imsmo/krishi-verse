// apps/worker/src/registry.ts · the operational jobs this worker runs on a schedule. Each is pg-native + bounded.
// Domain-handler jobs (notification dispatch, settlement, outbox HANDLER execution) require the api business
// logic and are intentionally NOT here — see WORKER-RUNTIME.md "Deferred: domain-handler jobs".
import { Job } from './jobs/index';
import { reconZeroSumJob } from './jobs/recon-zero-sum.job';
import { ensurePartitionsJob } from './jobs/ensure-partitions.job';
import { retentionEnforcerJob } from './jobs/retention-enforcer.job';
import { idempotencyPurgeJob } from './jobs/idempotency-purge.job';
import { dpdpErasureCoolingJob } from './jobs/dpdp-erasure-cooling.job';
import { outboxGaugeJob } from './jobs/outbox-gauge.job';
import { webhookDeliveryJob } from './jobs/webhook-delivery.job';

export const JOBS: Job[] = [
  reconZeroSumJob,
  ensurePartitionsJob,
  retentionEnforcerJob,
  idempotencyPurgeJob,
  dpdpErasureCoolingJob,
  outboxGaugeJob,
  webhookDeliveryJob, // P1-11: signed outbound webhook delivery (decrypts per-endpoint secret, HMAC, backoff)
];
