// modules/labour/jobs/booking-respond-timeout.job.ts
// Worker job (kv_relay): expire OPEN bookings whose respond_by has passed (and lapse their pending
// assignments). Claims across tenants (FOR UPDATE SKIP LOCKED), bounded per tick; each expireBooking()
// is idempotent (skips bookings no longer open). NOT a DI provider (it takes a privileged Pool) —
// instantiated by apps/worker (or tests) with the kv_relay pool. Mirrors the offers/auction expiry jobs.
import type { Pool } from 'pg';
import { TxContext } from '../../../core/database/unit-of-work';
import { LabourBookingRepository } from '../repositories/labour-booking.repository';
import { LabourBookingService } from '../services/labour-booking.service';

export class BookingRespondTimeoutJob {
  constructor(private readonly systemPool: Pool, private readonly repo: LabourBookingRepository, private readonly svc: LabourBookingService) {}

  async run(limit = 200): Promise<{ expired: number; failed: number }> {
    const client = await this.systemPool.connect();
    let due: Array<{ id: string; tenantId: string }> = [];
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      due = (await this.repo.findDueToExpire(tx, new Date(), limit)).map((b) => ({ id: b.id, tenantId: b.toProps().tenantId }));
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }

    let expired = 0, failed = 0;
    for (const d of due) { try { await this.svc.expireBooking(d.tenantId, d.id); expired++; } catch { failed++; } }
    return { expired, failed };
  }
}
