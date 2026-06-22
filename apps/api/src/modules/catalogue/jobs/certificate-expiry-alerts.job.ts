// modules/catalogue/jobs/certificate-expiry-alerts.job.ts
// Worker job (kv_relay): flip verified certificates whose valid_until has passed → expired. Claims across tenants
// (FOR UPDATE SKIP LOCKED), bounded per tick; each expire() is idempotent (skips a cert no longer verified) and
// emits catalogue.certificate_expired to the outbox in its own tx. NOT a DI provider — apps/worker instantiates
// it with the kv_relay pool. Mirrors offers/jobs/expire-offers.job.
import type { Pool } from 'pg';
import { TxContext } from '../../../core/database/unit-of-work';
import { CertificateRepository } from '../repositories/certificate.repository';
import { CertificateService } from '../services/certificate.service';

export class CertificateExpiryAlertsJob {
  constructor(private readonly systemPool: Pool, private readonly repo: CertificateRepository, private readonly certs: CertificateService) {}

  async run(limit = 200): Promise<{ expired: number; failed: number }> {
    const client = await this.systemPool.connect();
    let due: Array<{ id: string; tenantId: string }> = [];
    try {
      await client.query('BEGIN');
      const tx: TxContext = { query: (sql, params) => client.query(sql, params as any) as any, tenantId: '', userId: 'system' };
      due = await this.repo.findDueToExpire(tx, new Date(), limit);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => undefined); throw e; } finally { client.release(); }

    let expired = 0, failed = 0;
    for (const d of due) { try { await this.certs.expire(d.tenantId, d.id); expired++; } catch { failed++; } }
    return { expired, failed };
  }
}
