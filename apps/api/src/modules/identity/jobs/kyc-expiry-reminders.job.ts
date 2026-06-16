// modules/identity/jobs/kyc-expiry-reminders.job.ts · worker job: nudge users whose verified
// KYC expires soon (renewal compliance). Emits a reminder event via the outbox.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';

@Injectable()
export class KycExpiryRemindersJob {
  private readonly log = new Logger(KycExpiryRemindersJob.name);
  constructor(@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork, @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter) {}
  /** Within `days`, remind once. Returns number of reminders queued for the tenant. */
  async runForTenant(tenantId: string, days = 30): Promise<number> {
    return this.uow.run(tenantId, async (tx) => {
      const due = await tx.query<{ id: string; user_id: string; valid_until: string }>(
        `SELECT id, user_id, valid_until FROM kyc_documents
          WHERE tenant_id = $1 AND status='verified' AND valid_until IS NOT NULL
            AND valid_until <= (now() + ($2 || ' days')::interval)::date AND deleted_at IS NULL
          LIMIT 500`, [tenantId, days]);
      for (const d of due.rows) {
        await this.outbox.write(tx, { tenantId, aggregateType: 'kyc_document', aggregateId: d.id, eventType: 'identity.kyc_expiring', payload: { v: 1, userId: d.user_id, validUntil: d.valid_until } });
      }
      if (due.rows.length) this.log.log(`queued ${due.rows.length} KYC expiry reminders for tenant ${tenantId}`);
      return due.rows.length;
    });
  }
}
