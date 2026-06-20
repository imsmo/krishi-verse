// modules/fintech/repositories/loan-repayment.repository.ts · all SQL for loan_repayments (PARTITIONED by
// created_at). tenant_id in EVERY query (Law 1) + RLS. The list bounds created_at so PG prunes partitions
// (Law 8). Append-only payment rows.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { LoanRepayment } from '../domain/loan-repayment.entity';

const COLS = `id, loan_id, tenant_id, due_date, amount_due_minor, amount_paid_minor, paid_at, channel, created_at`;
const d = (v: any): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
function toDomain(r: any): LoanRepayment {
  return LoanRepayment.rehydrate({ id: r.id, loanId: r.loan_id, tenantId: r.tenant_id, dueDate: d(r.due_date), amountDueMinor: BigInt(r.amount_due_minor), amountPaidMinor: BigInt(r.amount_paid_minor), paidAt: r.paid_at, channel: r.channel, createdAt: r.created_at });
}
@Injectable()
export class LoanRepaymentRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async insert(tx: TxContext, r: LoanRepayment): Promise<void> {
    const p = r.toProps();
    await tx.query(`INSERT INTO loan_repayments (id, loan_id, tenant_id, due_date, amount_due_minor, amount_paid_minor, paid_at, channel) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [p.id, p.loanId, p.tenantId, p.dueDate, p.amountDueMinor.toString(), p.amountPaidMinor.toString(), p.paidAt, p.channel]);
  }
  /** Recent repayments for a loan (created_at-bounded window prunes the partitioned scan). */
  async listForLoan(tenantId: string, loanId: string): Promise<LoanRepayment[]> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM loan_repayments WHERE tenant_id=$1 AND loan_id=$2 AND created_at >= now() - interval '5 years' ORDER BY created_at DESC, id DESC LIMIT 500`, [tenantId, loanId]);
    return r.rows.map(toDomain);
  }
}
