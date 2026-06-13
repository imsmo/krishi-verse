// core/quota/quota.service.ts
// Enforces plan_limits (usage_counters). assertWithinLimit BEFORE the write;
// increment INSIDE the same tx so usage and the entity commit atomically.
import { TxContext } from '../database/unit-of-work';
export abstract class QuotaService {
  abstract assertWithinLimit(tenantId: string, metric: string): Promise<void>;
  abstract increment(tx: TxContext, tenantId: string, metric: string, by: number): Promise<void>;
}
export const QUOTA_SERVICE = Symbol('QUOTA_SERVICE');
