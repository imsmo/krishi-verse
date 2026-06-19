// modules/contract-farming/repositories/farming-contract.repository.ts · all SQL for farming_contracts.
// tenant_id in EVERY query (Law 1) + RLS. No version column → mutations lock FOR UPDATE. Keyset lists.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { FarmingContract } from '../domain/farming-contract.entity';
import { ContractKind, PriceModel } from '../domain/contract-farming.events';
import { ContractStatus } from '../domain/farming-contract.state';

const COLS = `id, tenant_id, contract_no, template_id, buyer_user_id, contract_kind, product_id, total_quantity, unit_code, price_model, price_terms, quality_spec, season, status, signed_at, created_at`;
const toMilli = (v: any): bigint => BigInt(Math.round(Number(v) * 1000));
const milliToNum = (m: bigint) => (Number(m) / 1000).toFixed(3);
function toDomain(r: any): FarmingContract {
  return FarmingContract.rehydrate({ id: r.id, tenantId: r.tenant_id, contractNo: r.contract_no, templateId: r.template_id, buyerUserId: r.buyer_user_id, contractKind: r.contract_kind as ContractKind,
    productId: r.product_id, totalQuantityMilli: toMilli(r.total_quantity), unitCode: r.unit_code, priceModel: r.price_model as PriceModel, priceTerms: r.price_terms ?? {}, qualitySpec: r.quality_spec ?? {},
    season: r.season, status: r.status as ContractStatus, signedAt: r.signed_at, createdAt: r.created_at });
}
export interface ContractListQuery { buyerUserId?: string; status?: string; cursor?: { c: string; id: string }; limit: number; }

@Injectable()
export class FarmingContractRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, c: FarmingContract): Promise<void> {
    const p = c.toProps();
    await tx.query(
      `INSERT INTO farming_contracts (id, tenant_id, contract_no, template_id, buyer_user_id, contract_kind, product_id, total_quantity, unit_code, price_model, price_terms, quality_spec, season, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$5)`,
      [p.id, p.tenantId, p.contractNo, p.templateId, p.buyerUserId, p.contractKind, p.productId, milliToNum(p.totalQuantityMilli), p.unitCode, p.priceModel, JSON.stringify(p.priceTerms), JSON.stringify(p.qualitySpec), p.season, p.status]);
  }
  async getForUpdate(tx: TxContext, tenantId: string, id: string): Promise<FarmingContract | null> {
    const r = await tx.query(`SELECT ${COLS} FROM farming_contracts WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE`, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async getById(tenantId: string, id: string, tx?: TxContext): Promise<FarmingContract | null> {
    const sql = `SELECT ${COLS} FROM farming_contracts WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`;
    const r = tx ? await tx.query(sql, [id, tenantId]) : await this.replica.forTenant(tenantId).query(sql, [id, tenantId]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async update(tx: TxContext, c: FarmingContract): Promise<void> {
    const p = c.toProps();
    await tx.query(`UPDATE farming_contracts SET status=$3, signed_at=$4, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL`, [p.id, p.tenantId, p.status, p.signedAt]);
  }
  async listFor(tenantId: string, q: ContractListQuery): Promise<FarmingContract[]> {
    const params: unknown[] = [tenantId];
    let where = `tenant_id=$1 AND deleted_at IS NULL`;
    const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (q.buyerUserId) where += ` AND buyer_user_id=${p(q.buyerUserId)}`;
    if (q.status) where += ` AND status=${p(q.status)}`;
    if (q.cursor) { const cc = p(q.cursor.c), ci = p(q.cursor.id); where += ` AND (created_at < ${cc} OR (created_at=${cc} AND id < ${ci}))`; }
    const lp = p(q.limit);
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM farming_contracts WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ${lp}`, params);
    return r.rows.map(toDomain);
  }
}
