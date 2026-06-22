// modules/tenancy/repositories/tenant-domain.repository.ts · SQL for tenant_domains (0002). tenant_id in EVERY
// query (Law 1) + RLS. No version col → mutations lock the row. Reads on the replica; keyset on (created_at, id).
// UNIQUE(domain) globally → a clash surfaces as a typed 409 (a tenant can't hijack another's domain).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { TenantDomain, TlsStatus } from '../domain/tenant-domain.entity';
import { DomainExistsError } from '../domain/tenancy.errors';

const COLS = `id, tenant_id, domain, is_primary, tls_status, verified_at, created_at`;
function toDomain(r: any): TenantDomain {
  return TenantDomain.rehydrate({ id: r.id, tenantId: r.tenant_id, domain: r.domain, isPrimary: r.is_primary, tlsStatus: r.tls_status as TlsStatus, verifiedAt: r.verified_at, createdAt: r.created_at });
}
export interface DomainListQuery { cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class TenantDomainRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  async insert(tx: TxContext, d: TenantDomain): Promise<void> {
    const p = d.toProps();
    try {
      await tx.query(
        `INSERT INTO tenant_domains (id, tenant_id, domain, is_primary, tls_status, verified_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6, now())`,
        [p.id, p.tenantId, p.domain, p.isPrimary, p.tlsStatus, p.verifiedAt]);
    } catch (e: any) { if (e?.code === '23505') throw new DomainExistsError(p.domain); throw e; }
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<TenantDomain | null> {
    const r = await tx.query(`SELECT ${COLS} FROM tenant_domains WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string): Promise<TenantDomain | null> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM tenant_domains WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  /** Demote the current primary (within the same tx) before promoting another — keeps one-primary invariant. */
  async clearPrimary(tx: TxContext, tenantId: string): Promise<void> {
    await tx.query(`UPDATE tenant_domains SET is_primary=false, updated_at=now() WHERE tenant_id=$1 AND is_primary=true`, [tenantId]);
  }
  async update(tx: TxContext, d: TenantDomain): Promise<void> {
    const p = d.toProps();
    await tx.query(
      `UPDATE tenant_domains SET is_primary=$3, tls_status=$4, verified_at=$5, updated_at=now() WHERE id=$1 AND tenant_id=$2`,
      [p.id, p.tenantId, p.isPrimary, p.tlsStatus, p.verifiedAt]);
  }
  async remove(tx: TxContext, tenantId: string, id: string): Promise<number> {
    const r = await tx.query(`DELETE FROM tenant_domains WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
    return r.rowCount ?? 0;
  }
  async list(tenantId: string, q: DomainListQuery): Promise<TenantDomain[]> {
    const params: unknown[] = [tenantId];
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    let where = `tenant_id=$1`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM tenant_domains WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
