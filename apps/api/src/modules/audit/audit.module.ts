// modules/audit/audit.module.ts
// Audit-trail viewer (PRD §7 · auditor surface): a strictly READ-ONLY window onto the append-only audit_log
// for the tenant's auditor/accountant role. The trail itself is written only by core/audit AuditWriter inside
// business transactions; this module never writes. Reads run on the shard REPLICA under the tenant's RLS
// (audit_log carries tenant_id → 0014 auto-applies the tenant_isolation policy), keyset-paginated.
// Gated by the `audit_trail` feature flag (default OFF) + the `audit.read` permission (auditor, tenant_admin).
//
// SCOPE (this build): browse (filter by action / entity / actor / time window) + entry detail. No new migration
// (rides the existing 0014 audit_log + its RLS). DEFERRED: CSV/PDF export of a filtered range (a media follow-on).
import { Module } from '@nestjs/common';
import { AuditController } from './controllers/v1/audit.controller';
import { AuditService } from './services/audit.service';
import { AuditRepository } from './repositories/audit.repository';

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditTrailModule {}
