// core/database/read-replica.provider.ts
// Provides a REPLICA executor for reads that tolerate ~1s lag (CQRS read path,
// Law 12). Writes never use this. Routed to the tenant's shard replica.
import { SqlExecutor } from './unit-of-work';
export abstract class ReadReplicaProvider { abstract forTenant(tenantId: string): SqlExecutor; }
export const READ_REPLICA = Symbol('READ_REPLICA');
