// apps/web-partner/src/features/lending/loan.ts · PURE helpers for the lender's disbursed-loan PORTFOLIO + the
// repayment schedule. Mirrors apps/api fintech loan.state + loan / loan-repayment read-models EXACTLY. No I/O, no
// React. All money is bigint MINOR-UNIT strings (Law 2): paid/outstanding/balance are computed with BigInt only,
// avoiding the float-coercion helpers the §4 audit forbids. Dates are YYYY-MM-DD strings compared lexicographically (safe for ISO
// dates) for overdue flagging.

// ---- loan state machine (mirror domain/loan.state.ts) -----------------------------------------------------------
export const LOAN_STATUSES = ['active', 'overdue', 'closed', 'written_off'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export function isLoanStatus(v: string | undefined): v is LoanStatus {
  return !!v && (LOAN_STATUSES as readonly string[]).includes(v);
}
/** A loan is still being serviced while active or overdue (mirror isServicing). */
export function isServicing(s: LoanStatus): boolean {
  return s === 'active' || s === 'overdue';
}
export function loanStatusKey(status: string): string {
  return isLoanStatus(status) ? `loan2.st.${status}` : 'loan2.st.unknown';
}
export function loanStatusTone(status: string): 'ok' | 'info' | 'danger' | 'muted' {
  if (status === 'active') return 'info';
  if (status === 'overdue' || status === 'written_off') return 'danger';
  if (status === 'closed') return 'ok';
  return 'muted';
}

// ---- money (bigint minor units, float-free) ---------------------------------------------------------------------
function toBig(minor: string): bigint {
  try { return BigInt((minor ?? '').trim() || '0'); } catch { return 0n; }
}
/** Principal repaid so far = principal − outstanding (never negative). Returns a minor-unit string. */
export function repaidMinor(principalMinor: string, outstandingMinor: string): string {
  const paid = toBig(principalMinor) - toBig(outstandingMinor);
  return (paid < 0n ? 0n : paid).toString();
}
/** Remaining balance on a single scheduled repayment = due − paid (never negative). Minor-unit string. */
export function repaymentBalanceMinor(amountDueMinor: string, amountPaidMinor: string): string {
  const bal = toBig(amountDueMinor) - toBig(amountPaidMinor);
  return (bal < 0n ? 0n : bal).toString();
}

// ---- repayment status / overdue (date-string compare) -----------------------------------------------------------
/** A scheduled repayment is settled when it has a paidAt, or the paid amount covers the due amount. */
export function isRepaymentSettled(amountDueMinor: string, amountPaidMinor: string, paidAt: string | null): boolean {
  if (paidAt) return true;
  return toBig(amountPaidMinor) >= toBig(amountDueMinor);
}
/** ISO date (YYYY-MM-DD) past-due test — lexicographic compare is correct for zero-padded ISO dates. */
export function isPastDue(dueDate: string, today: string): boolean {
  return !!dueDate && !!today && dueDate < today;
}
/** A repayment is overdue when it is unsettled AND its due date is in the past. */
export function isRepaymentOverdue(r: { dueDate: string; amountDueMinor: string; amountPaidMinor: string; paidAt: string | null }, today: string): boolean {
  return !isRepaymentSettled(r.amountDueMinor, r.amountPaidMinor, r.paidAt) && isPastDue(r.dueDate, today);
}

// ---- portfolio list query (lender book) -------------------------------------------------------------------------
// The API's `box` for loans is mine|all; a lender views their funded book via `all` (RLS scopes it to the partner).
export interface LoanListQuery { box: 'all'; status?: LoanStatus; cursor?: string; limit: number; }
export function buildLoanListQuery(raw: { status?: string; cursor?: string }): LoanListQuery {
  const status = isLoanStatus(raw.status) ? raw.status : undefined;
  const cursor = (raw.cursor ?? '').trim() || undefined;
  return { box: 'all', status, cursor, limit: 50 };
}
export function portfolioHref(status?: LoanStatus, cursor?: string): string {
  const p = new URLSearchParams();
  if (status) p.set('status', status);
  if (cursor) p.set('cursor', cursor);
  const qs = p.toString();
  return qs ? `/portfolio?${qs}` : '/portfolio';
}

// ---- read-model types (mirror loan + loan-repayment toJSON) -----------------------------------------------------
export interface LoanRow {
  id: string; applicationId: string; borrowerUserId: string; partnerId: string;
  principalMinor: string; interestAprBps: number; disbursedAt: string; maturityDate: string | null;
  status: string; outstandingMinor: string; nextDueDate: string | null;
}
export interface RepaymentRow {
  id: string; loanId: string; dueDate: string; amountDueMinor: string; amountPaidMinor: string;
  paidAt: string | null; channel: string | null;
}
