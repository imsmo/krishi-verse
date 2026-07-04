// modules/payments/repositories/mandate-execution.repository.ts
// SQL for upi_mandate_executions (tenant_id in EVERY query — Law 1; RLS is the net). An execution row is
// the audit + idempotency record that links one collection attempt to its wallet ledger txn. It NEVER holds
// money. Idempotency is enforced by uq_mandate_exec_idem(tenant_id, idempotency_key): findByIdem lets the
// service short-circuit a replay before it ever calls the PSP or the wallet.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';

export type MandateExecutionStatus = 'pending' | 'collected' | 'failed';

export interface MandateExecutionRow {
  id: string; tenantId: string; mandateId: string; userId: string;
  amountMinor: bigint; currencyCode: string; status: MandateExecutionStatus;
  providerPaymentRef: string | null; ledgerTxnId: string | null;
  idempotencyKey: string; failureReason: string | null; createdAt: Date;
}

const COLS = `id, tenant_id, mandate_id, user_id, amount_minor, currency_code, status,
  provider_payment_ref, ledger_txn_id, idempotency_key, failure_reason, created_at`;

function toRow(r: any): MandateExecutionRow {
  return {
    id: r.id, tenantId: r.tenant_id, mandateId: r.mandate_id, userId: r.user_id,
    amountMinor: BigInt(r.amount_minor), currencyCode: r.currency_code, status: r.status,
    providerPaymentRef: r.provider_payment_ref, ledgerTxnId: r.ledger_txn_id,
    idempotencyKey: r.idempotency_key, failureReason: r.failure_reason, createdAt: r.created_at,
  };
}

@Injectable()
export class MandateExecutionRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Insert a fresh 'pending' execution. Unique on (tenant_id, idempotency_key). */
  async insertPending(tx: TxContext, e: {
    id: string; tenantId: string; mandateId: string; userId: string;
    amountMinor: bigint; currencyCode: string; idempotencyKey: string;
  }): Promise<void> {
    await tx.query(
      `INSERT INTO upi_mandate_executions
         (id, tenant_id, mandate_id, user_id, amount_minor, currency_code, status, idempotency_key, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$4)`,
      [e.id, e.tenantId, e.mandateId, e.userId, e.amountMinor.toString(), e.currencyCode, e.idempotencyKey]);
  }

  /** Return an existing execution for this idempotency key, if any (replay short-circuit). Locked in-tx. */
  async findByIdemForUpdate(tx: TxContext, tenantId: string, idempotencyKey: string): Promise<MandateExecutionRow | null> {
    const r = await tx.query(
      `SELECT ${COLS} FROM upi_mandate_executions WHERE tenant_id=$1 AND idempotency_key=$2 FOR UPDATE`,
      [tenantId, idempotencyKey]);
    return r.rows[0] ? toRow(r.rows[0]) : null;
  }

  /** Stamp a successful collection: provider ref + the wallet txn that moved the money. */
  async markCollected(tx: TxContext, tenantId: string, id: string, providerPaymentRef: string, ledgerTxnId: string): Promise<void> {
    await tx.query(
      `UPDATE upi_mandate_executions SET status='collected', provider_payment_ref=$3, ledger_txn_id=$4, updated_at=now()
       WHERE id=$1 AND tenant_id=$2`, [id, tenantId, providerPaymentRef, ledgerTxnId]);
  }

  /** Stamp a failed collection with a non-sensitive reason (never store PSP secrets/PII). */
  async markFailed(tx: TxContext, tenantId: string, id: string, reason: string): Promise<void> {
    await tx.query(
      `UPDATE upi_mandate_executions SET status='failed', failure_reason=$3, updated_at=now()
       WHERE id=$1 AND tenant_id=$2`, [id, tenantId, reason.slice(0, 500)]);
  }

  /** Recent executions for a mandate the caller owns (audit list; replica read). */
  async listForMandate(tenantId: string, mandateId: string, limit: number): Promise<MandateExecutionRow[]> {
    const lim = Math.min(Math.max(limit, 1), 100);
    const r = await this.replica.forTenant(tenantId).query(
      `SELECT ${COLS} FROM upi_mandate_executions WHERE tenant_id=$1 AND mandate_id=$2
       ORDER BY created_at DESC, id DESC LIMIT ${lim}`, [tenantId, mandateId]);
    return r.rows.map(toRow);
  }
}
