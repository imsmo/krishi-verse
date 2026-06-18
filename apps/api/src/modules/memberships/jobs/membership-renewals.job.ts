// modules/memberships/jobs/membership-renewals.job.ts
// Worker job (kv_relay): EXPIRE memberships whose paid period has ended (status active|past_due →
// expired). Claims across tenants (FOR UPDATE SKIP LOCKED), bounded per tick; each expire() is
// idempotent (skips non-live / not-yet-due). NOT a DI provider — instantiated by apps/worker with the
// privileged kv_relay Pool, mirroring the auction/offer/requirement jobs.
//
// NOTE: this job does NOT auto-charge a renewal — auto-debiting a wallet requires a stored mandate/
// consent (deferred). Renewal is member-initiated (UserMembershipService.renew). The job only lapses.
import type { Pool } from 'pg';
import { TxContext } from '../../../core/database/unit-of-work';
import { UserMembershipRepository } from '../repositories/user-membership.repository';
import { UserMembershipService } from '../services/user-membership.service';

export class MembershipRenewalsJob {
  constructor(private readonly systemPool: Pool, private readonly repo: UserMembershipRepository, private readonly memberships: UserMembershipService) {}

  async run(limit = 200): Promise<{ expired: number; failed: number }> {
    const client = await this.systemPool.connect();
    let due: Array<{ id: string; tenantId: string }> = [];
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      due = (await this.repo.findDueToExpire(tx, new Date(), limit)).map((m) => ({ id: m.id, tenantId: m.toProps().tenantId }));
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }

    let expired = 0, failed = 0;
    for (const d of due) { try { await this.memberships.expire(d.tenantId, d.id); expired++; } catch { failed++; } }
    return { expired, failed };
  }
}
