// modules/fintech/services/loan.service.ts · loan SERVICING — repayment (the money-in path).
// repay: the borrower pays toward the loan — borrower userMain → tenant 'main' (txnType 'loan_repayment',
// zero-sum + idempotent — Law 2); the outstanding is reduced (exact bigint) and the loan CLOSES at zero. A
// loan_repayment row is recorded (partitioned). Every write: one ACID tx (UoW), state via the machine
// (Law 5), outbox in-tx (Law 4), idempotent money mutation (Law 3), authz THROWS (Law 6). FOR UPDATE lock.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { WALLET_SERVICE, WalletPort } from '../../../core/wallet/wallet.port';
import { userMain, TenantAccount } from '../../../core/wallet/account-codes';
import { AccountRef } from '../../../core/wallet/account-codes';
import { uuidv7 } from '../../../core/database/uuid.util';
import { LoanRepayment } from '../domain/loan-repayment.entity';
import { DomainEvent } from '../domain/fintech.events';
import { LoanRepository } from '../repositories/loan.repository';
import { LoanRepaymentRepository } from '../repositories/loan-repayment.repository';
import { RepayLoanDto } from '../dto/create-loan-repayment.dto';
import { LoanNotFoundError, FintechForbiddenError } from '../domain/fintech.errors';
import { FintechActor } from './loan-application.service';

const tenantMain = (tenantId: string): AccountRef => ({ kind: 'tenant', tenantId, accountCode: TenantAccount.Main, currencyCode: 'INR' });

@Injectable()
export class LoanService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    @Inject(WALLET_SERVICE) private readonly wallet: WalletPort,
    private readonly loans: LoanRepository,
    private readonly repayments: LoanRepaymentRepository,
  ) {}

  async repay(tenantId: string, actor: FintechActor, loanId: string, idemKey: string, dto: RepayLoanDto, ip: string | null) {
    if (!actor.canBorrow && !actor.canManage) throw new FintechForbiddenError('requires loan.borrow');
    return this.idem.remember(idemKey, actor.userId, 'fintech.loan.repay', () =>
      timed(this.metrics, 'fintech.loan.repay', { tenant: tenantId }, () =>
        this.uow.run(tenantId, async (tx) => {
          const loan = await this.loans.getForUpdate(tx, tenantId, loanId);
          if (!loan) throw new LoanNotFoundError(loanId);
          if (loan.borrowerUserId !== actor.userId && !actor.canManage) throw new FintechForbiddenError('only the borrower may repay this loan');
          const amount = BigInt(dto.amountMinor);
          loan.repay(amount, new Date());   // throws OverRepayment / not-servicing; closes at zero
          await this.loans.update(tx, loan);
          const now = new Date();
          const rep = LoanRepayment.record({ id: uuidv7(), loanId, tenantId, dueDate: now.toISOString().slice(0, 10), amountDueMinor: amount, amountPaidMinor: amount, paidAt: now, channel: dto.channel });
          await this.repayments.insert(tx, rep);
          // Borrower repays into the FPO/tenant lending pool — a balanced, idempotent transfer (Law 2).
          await this.wallet.post(tx, { tenantId, txnType: 'loan_repayment', idempotencyKey: `loan-repay:${rep.id}`, referenceType: 'loan', referenceId: loanId, initiatedBy: actor.userId,
            legs: [{ account: userMain(loan.borrowerUserId), amountMinor: -amount }, { account: tenantMain(tenantId), amountMinor: amount }] });
          await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'fintech.loan.repaid', entityType: 'loan', entityId: loanId, newValue: { amountMinor: amount.toString(), outstandingMinor: loan.outstandingMinor.toString() }, ip });
          await this.flush(tx, tenantId, loanId, loan.pullEvents());
          return { ...loan.toJSON(), repaymentId: rep.id };
        }, { userId: actor.userId })));
  }

  async getById(tenantId: string, actor: FintechActor, id: string) {
    const l = await this.loans.getById(tenantId, id);
    if (!l) throw new LoanNotFoundError(id);
    if (l.borrowerUserId !== actor.userId && !actor.canManage) throw new LoanNotFoundError(id); // 404, no IDOR
    return l.toJSON();
  }
  async list(tenantId: string, actor: FintechActor, q: { box: 'mine' | 'all'; status?: string; cursor?: { c: string; id: string }; limit: number }) {
    if (q.box === 'all' && !actor.canManage) throw new FintechForbiddenError('requires loan.manage');
    const rows = await this.loans.listFor(tenantId, { borrowerUserId: q.box === 'mine' ? actor.userId : undefined, status: q.status, cursor: q.cursor, limit: q.limit });
    const items = rows.map((l) => l.toJSON());
    const last = items[items.length - 1];
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  async listRepayments(tenantId: string, actor: FintechActor, loanId: string) {
    const loan = await this.loans.getById(tenantId, loanId);
    if (!loan) throw new LoanNotFoundError(loanId);
    if (loan.borrowerUserId !== actor.userId && !actor.canManage) throw new LoanNotFoundError(loanId); // 404, no IDOR
    return (await this.repayments.listForLoan(tenantId, loanId)).map((r) => r.toJSON());
  }
  private async flush(tx: TxContext, tenantId: string, id: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'loan', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
