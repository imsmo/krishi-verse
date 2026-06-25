// apps/worker/src/jobs/index.ts · a Job = a pg-native operational task. ctx gives a client (already under the
// job's advisory lock + statement timeout) + the metrics registry. Jobs are idempotent + bounded (LIMIT/cap).
import { PoolClient } from 'pg';
import { WorkerMetrics } from '../metrics';

export interface JobCtx { client: PoolClient; metrics: WorkerMetrics }
export interface Job { name: string; intervalSec: number; run(ctx: JobCtx): Promise<void> }
