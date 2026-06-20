// modules/fintech/domain/loan.entity.ts · the loans aggregate (post-disbursal servicing mirror).
// Created on disbursal with outstanding = principal. Repayments reduce the outstanding (exact bigint); when
// it reaches zero the loan CLOSES. Money is bigint minor units (Law 2). No version → repo locks FOR UPDATE.
import { LoanStatus, assertTransition } from './loan.state';
import { DomainEvent, FintechEventType } from './fintech.events';
import { OverRepaymentError, InvalidLoanError } from './fintech.errors';

export interface LoanProps {
  id: string; applicationId: string; tenantId: string; borrowerUserId: string; partnerId: string;
  principalMinor: bigint; interestAprBps: number; disbursedAt: string; maturityDate: string | null; status: LoanStatus; outstandingMinor: bigint; nextDueDate: string | null; createdAt?: Date;
}
export class Loan {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: LoanProps) {}

  static open(input: Omit<LoanProps, 'status' | 'outstandingMinor'>): Loan {
    if (input.principalMinor <= 0n) throw new InvalidLoanError('principal must be greater than zero');
    const l = new Loan({ ...input, status: 'active', outstandingMinor: input.principalMinor });
    return l;   // the disbursal event is emitted by the application aggregate
  }
  static rehydrate(props: LoanProps): Loan { return new Loan(props); }

  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get borrowerUserId() { return this.props.borrowerUserId; }
  get status() { return this.props.status; }
  get outstandingMinor() { return this.props.outstandingMinor; }
  toProps(): Readonly<LoanProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  /** Apply a repayment to the principal outstanding. Closes the loan when it reaches zero. */
  repay(amountMinor: bigint, now: Date): void {
    if (amountMinor <= 0n) throw new InvalidLoanError('repayment must be greater than zero');
    if (this.props.status !== 'active' && this.props.status !== 'overdue') throw new InvalidLoanError(`loan is not servicing (status: ${this.props.status})`);
    if (amountMinor > this.props.outstandingMinor) throw new OverRepaymentError(this.props.outstandingMinor);
    this.props.outstandingMinor -= amountMinor;
    this.events.push({ type: FintechEventType.LoanRepaid, payload: { loanId: this.props.id, amountMinor: amountMinor.toString(), outstandingMinor: this.props.outstandingMinor.toString() } });
    if (this.props.outstandingMinor === 0n) {
      assertTransition(this.props.status, 'closed'); this.props.status = 'closed';
      this.events.push({ type: FintechEventType.LoanClosed, payload: { loanId: this.props.id } });
    }
  }
  markOverdue(): void { assertTransition(this.props.status, 'overdue'); this.props.status = 'overdue'; }
  cure(): void { assertTransition(this.props.status, 'active'); this.props.status = 'active'; }
  toJSON() { const v = this.props; return { id: v.id, applicationId: v.applicationId, borrowerUserId: v.borrowerUserId, partnerId: v.partnerId,
    principalMinor: v.principalMinor.toString(), interestAprBps: v.interestAprBps, disbursedAt: v.disbursedAt, maturityDate: v.maturityDate,
    status: v.status, outstandingMinor: v.outstandingMinor.toString(), nextDueDate: v.nextDueDate, createdAt: v.createdAt }; }
}
