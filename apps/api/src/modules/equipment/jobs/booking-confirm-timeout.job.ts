// modules/equipment/jobs/booking-confirm-timeout.job.ts
// Worker job (kv_relay): cancel rental bookings left un-confirmed past their scheduled time (requested|
// quoted → cancelled). No escrow is held before confirmation, so nothing to refund. Claims across tenants
// (FOR UPDATE SKIP LOCKED), bounded per tick; each timeout() is idempotent. NOT a DI provider (it takes a
// privileged Pool) — instantiated by apps/worker. Mirrors the other expiry jobs.
import type { Pool } from 'pg';
import { TxContext } from '../../../core/database/unit-of-work';
import { EquipmentBookingRepository } from '../repositories/equipment-booking.repository';
import { EquipmentBookingService } from '../services/equipment-booking.service';

export class BookingConfirmTimeoutJob {
  constructor(private readonly systemPool: Pool, private readonly repo: EquipmentBookingRepository, private readonly svc: EquipmentBookingService) {}
  async run(limit = 200): Promise<{ cancelled: number; failed: number }> {
    const client = await this.systemPool.connect();
    let due: Array<{ id: string; tenantId: string }> = [];
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      due = await this.repo.findDueToTimeout(tx, new Date(), limit);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }
    let cancelled = 0, failed = 0;
    for (const d of due) { try { await this.svc.timeout(d.tenantId, d.id); cancelled++; } catch { failed++; } }
    return { cancelled, failed };
  }
}
