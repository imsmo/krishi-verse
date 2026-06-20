// modules/fintech/domain/loan-application.entity.ts · the loan_applications aggregate root.
// Origination lifecycle via loan-application.state. Anti-predatory: approval opens a COOLING-OFF window
// (PRD §59.4) during which the applicant may withdraw and disbursal is blocked. Money is bigint minor units.
// No version column → repo locks FOR UPDATE.
import { AppStatus, assertTransition } from './loan-application.state';
import { DomainEvent, FintechEventType } from './fintech.events';
import { ApprovedExceedsRequestedError, CoolingOffActiveError, InvalidLoanError } from './fintech.errors';

export interface LoanApplicationProps {
  id: string; tenantId: string; applicantUserId: string; productId: string; partnerId: string;
  amountRequestedMinor: bigint; purposeText: string | null; status: AppStatus; nwrId: string | null;
  decisionAt: Date | null; decisionNote: string | null; amountApprovedMinor: bigint | null; coolingOffUntil: Date | null; createdAt?: Date;
}
export class LoanApplication {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: LoanApplicationProps) {}

  static apply(input: Omit<LoanApplicationProps, 'status' | 'decisionAt' | 'decisionNote' | 'amountApprovedMinor' | 'coolingOffUntil'>): LoanApplication {
    if (input.amountRequestedMinor <= 0n) throw new InvalidLoanError('requested amount must be greater than zero');
    const a = new LoanApplication({ ...input, status: 'submitted', decisionAt: null, decisionNote: null, amountApprovedMinor: null, coolingOffUntil: null });
    a.events.push({ type: FintechEventType.ApplicationSubmitted, payload: { applicationId: a.props.id, applicantUserId: a.props.applicantUserId, productId: a.props.productId, amountRequestedMinor: a.props.amountRequestedMinor.toString() } });
    return a;
  }
  static rehydrate(props: LoanApplicationProps): LoanApplication { return new LoanApplication(props); }

  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get applicantUserId() { return this.props.applicantUserId; }
  get partnerId() { return this.props.partnerId; }
  get productId() { return this.props.productId; }
  get status() { return this.props.status; }
  get amountApprovedMinor() { return this.props.amountApprovedMinor; }
  get coolingOffUntil() { return this.props.coolingOffUntil; }
  toProps(): Readonly<LoanApplicationProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  private transition(to: AppStatus, eventType: string, extra: Record<string, unknown> = {}): void {
    const from = this.props.status; assertTransition(from, to); this.props.status = to;
    this.events.push({ type: eventType, payload: { applicationId: this.props.id, from, to, ...extra } });
  }
  startReview(): void { this.transition('under_review', FintechEventType.ApplicationReviewing); }
  approve(amountApprovedMinor: bigint, coolingOffUntil: Date, now: Date): void {
    if (amountApprovedMinor <= 0n) throw new InvalidLoanError('approved amount must be greater than zero');
    if (amountApprovedMinor > this.props.amountRequestedMinor) throw new ApprovedExceedsRequestedError();
    this.props.amountApprovedMinor = amountApprovedMinor; this.props.coolingOffUntil = coolingOffUntil; this.props.decisionAt = now;
    this.transition('approved', FintechEventType.ApplicationApproved, { amountApprovedMinor: amountApprovedMinor.toString(), coolingOffUntil: coolingOffUntil.toISOString() });
  }
  reject(note: string | null, now: Date): void { this.props.decisionNote = note; this.props.decisionAt = now; this.transition('rejected', FintechEventType.ApplicationRejected, note ? { note } : {}); }
  withdraw(): void { this.transition('withdrawn', FintechEventType.ApplicationWithdrawn); }
  /** Mark the approved application disbursed (the service creates the loan + moves the money). Cooling-off must have elapsed. */
  markDisbursed(now: Date): bigint {
    if (this.props.amountApprovedMinor == null) throw new InvalidLoanError('application is not approved');
    if (this.props.coolingOffUntil && now < this.props.coolingOffUntil) throw new CoolingOffActiveError(this.props.coolingOffUntil);
    this.transition('disbursed', FintechEventType.LoanDisbursed, { amountApprovedMinor: this.props.amountApprovedMinor.toString() });
    return this.props.amountApprovedMinor;
  }
  toJSON() { const v = this.props; return { id: v.id, applicantUserId: v.applicantUserId, productId: v.productId, partnerId: v.partnerId,
    amountRequestedMinor: v.amountRequestedMinor.toString(), amountApprovedMinor: v.amountApprovedMinor?.toString() ?? null, purposeText: v.purposeText,
    status: v.status, nwrId: v.nwrId, decisionAt: v.decisionAt, decisionNote: v.decisionNote, coolingOffUntil: v.coolingOffUntil, createdAt: v.createdAt }; }
}
