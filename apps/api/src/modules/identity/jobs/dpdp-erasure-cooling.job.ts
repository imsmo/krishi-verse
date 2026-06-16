// modules/identity/jobs/dpdp-erasure-cooling.job.ts · worker job: advance erasure requests
// whose 90-day cooling-off has elapsed to 'in_progress' so the erasure pipeline can run.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';

@Injectable()
export class DpdpErasureCoolingJob {
  constructor(@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork, @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter) {}
  async runForTenant(tenantId: string): Promise<number> {
    return this.uow.run(tenantId, async (tx) => {
      const due = await tx.query<{ id: string; user_id: string }>(
        `UPDATE data_subject_requests SET status='in_progress', updated_at=now()
          WHERE request_type='erasure' AND status='open' AND cooling_ends_at IS NOT NULL AND cooling_ends_at <= now()
          RETURNING id, user_id`, []);
      for (const r of due.rows) {
        await this.outbox.write(tx, { tenantId, aggregateType: 'user', aggregateId: r.user_id, eventType: 'identity.erasure_ready', payload: { v: 1, dsrId: r.id, userId: r.user_id } });
      }
      return due.rows.length;
    });
  }
}
