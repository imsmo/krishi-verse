// apps/web-partner/src/features/lending/application.ts · PURE helpers for the lender loan-application flow. Mirrors
// the apps/api fintech loan-application state machine EXACTLY (loan-application.state.ts):
//   draft → submitted → under_review → approved → disbursed   (+ rejected from review; withdrawn by applicant)
// No I/O, no React. Money is bigint MINOR-UNIT strings (Law 2): the approved amount is entered as whole rupees and
// converted to paise with BigInt (never a float multiply), avoiding the float-coercion helpers the §4 audit forbids.

export const APP_STATUSES = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn', 'disbursed'] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

const TRANSITIONS: Record<AppStatus, readonly AppStatus[]> = {
  draft: ['submitted', 'withdrawn'],
  submitted: ['under_review', 'withdrawn'],
  under_review: ['approved', 'rejected'],
  approved: ['disbursed', 'withdrawn'],
  rejected: [],
  withdrawn: [],
  disbursed: [],
};

export function isAppStatus(v: string): v is AppStatus {
  return (APP_STATUSES as readonly string[]).includes(v);
}
export function canTransition(from: AppStatus, to: AppStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function isTerminal(s: AppStatus): boolean {
  return s === 'rejected' || s === 'withdrawn' || s === 'disbursed';
}

// ---- lender decision gates (only the action legal for the current status is offered) ----------------------------
/** A lender begins review on a freshly submitted application (submitted → under_review). */
export function canReview(s: AppStatus): boolean { return s === 'submitted'; }
/** Approve / reject are only legal while under review. */
export function canApprove(s: AppStatus): boolean { return s === 'under_review'; }
export function canReject(s: AppStatus): boolean { return s === 'under_review'; }
/** Disburse is only legal once approved (the API additionally enforces the cooling-off window). */
export function canDisburse(s: AppStatus): boolean { return s === 'approved'; }

export function statusKey(status: string): string {
  return isAppStatus(status) ? `loan.st.${status}` : 'loan.st.unknown';
}
export function statusTone(status: string): 'ok' | 'warn' | 'info' | 'danger' | 'muted' {
  if (status === 'approved' || status === 'disbursed') return 'ok';
  if (status === 'submitted') return 'warn';
  if (status === 'under_review') return 'info';
  if (status === 'rejected') return 'danger';
  return 'muted'; // draft / withdrawn / unknown
}

// ---- money: ₹ whole rupees → paise minor-unit string (BigInt, float-free) ---------------------------------------
const RUPEES_RE = /^\d{1,13}$/;
const HOURS_RE = /^\d{1,4}$/;

export class LendingError extends Error {
  constructor(public readonly fieldKey: string) { super(fieldKey); this.name = 'LendingError'; }
}

/** Convert a whole-rupee string to a paise minor-unit string (× 100 via BigInt — never a float). */
export function rupeesToPaiseMinor(rawRupees: string): string {
  const v = (rawRupees ?? '').trim();
  if (!RUPEES_RE.test(v)) throw new LendingError('badAmount');
  return (BigInt(v) * 100n).toString();
}

export interface ApproveBody { amountApprovedMinor: string; coolingOffHours: number; }
/** Build the approve body: amount → paise (BigInt), cooling-off window an integer 0..720 hours (default 24). */
export function buildApprove(rawRupees: string, rawHours: string | undefined): ApproveBody {
  const amountApprovedMinor = rupeesToPaiseMinor(rawRupees);
  const h = (rawHours ?? '').trim();
  let coolingOffHours = 24;
  if (h.length > 0) {
    if (!HOURS_RE.test(h)) throw new LendingError('badAmount');
    const n = +h; // safe: digits only
    if (n > 720) throw new LendingError('badAmount');
    coolingOffHours = n;
  }
  return { amountApprovedMinor, coolingOffHours };
}

export interface RejectBody { note?: string; }
/** Build the reject body: an optional decision note (≤ 500 chars). */
export function buildReject(rawNote: string | undefined): RejectBody {
  const note = (rawNote ?? '').trim();
  if (note.length === 0) return {};
  if (note.length > 500) throw new LendingError('reason');
  return { note };
}

// ---- queue filters (mirror QueryApplicationsSchema box/status) --------------------------------------------------
// The API's `box` is one of mine|review|all. A lender is never the applicant, so the portal offers only the two
// lender-relevant boxes: `review` (their decision queue, the default) and `all` (everything routed to them).
export const LENDER_BOXES = ['review', 'all'] as const;
export type LenderBox = (typeof LENDER_BOXES)[number];

export function isLenderBox(v: string | undefined): v is LenderBox {
  return v === 'review' || v === 'all';
}
export function boxKey(box: LenderBox): string {
  return `loan.box.${box}`;
}

export interface ListQuery { box: LenderBox; status?: AppStatus; cursor?: string; limit: number; }
/** Normalise the queue's raw query params into the exact shape the SDK list call expects (keyset, limit 50).
 *  Unknown box → 'review'; unknown status → omitted; blank cursor → omitted. Pure + float-free. */
export function buildListQuery(raw: { box?: string; status?: string; cursor?: string }): ListQuery {
  const box: LenderBox = isLenderBox(raw.box) ? raw.box : 'review';
  const status = raw.status && isAppStatus(raw.status) ? raw.status : undefined;
  const cursor = (raw.cursor ?? '').trim() || undefined;
  return { box, status, cursor, limit: 50 };
}
/** Build a /loan-queue href preserving the active box + status (used by chips + the keyset pager). */
export function queueHref(box: LenderBox, status?: AppStatus, cursor?: string): string {
  const p = new URLSearchParams();
  if (box !== 'review') p.set('box', box);
  if (status) p.set('status', status);
  if (cursor) p.set('cursor', cursor);
  const qs = p.toString();
  return qs ? `/loan-queue?${qs}` : '/loan-queue';
}

// ---- read-model types (mirror the loan-application API read-model) ----------------------------------------------
export interface AppRow {
  id: string; status: string; amountRequestedMinor: string; amountApprovedMinor: string | null;
  purposeText: string | null; createdAt?: string;
}
export interface AppDetail extends AppRow {
  applicantUserId: string; productId: string; partnerId: string;
  nwrId: string | null; decisionAt: string | null; decisionNote: string | null; coolingOffUntil: string | null;
}
