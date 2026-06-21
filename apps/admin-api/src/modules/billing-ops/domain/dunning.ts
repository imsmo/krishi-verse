// apps/admin-api/src/modules/billing-ops/domain/dunning.ts · pure rules for dunning (payment-failure follow-up)
// on a SaaS invoice. An invoice can only be dunned while it owes money (issued/partially_paid/overdue) — never a
// draft, paid, or void invoice. Attempts are bounded so a buggy/abusive caller can't write a row per request (§4).
import { InvoiceStatus } from './invoice.state';
import { InvalidDunningError } from './billing-ops.errors';

export const DUNNING_CHANNELS = ['email', 'sms', 'whatsapp', 'call', 'in_app'] as const;
export type DunningChannel = (typeof DUNNING_CHANNELS)[number];
export const DUNNING_OUTCOMES = ['sent', 'promised_pay', 'failed', 'no_response'] as const;
export type DunningOutcome = (typeof DUNNING_OUTCOMES)[number];

const DUNNABLE: ReadonlySet<InvoiceStatus> = new Set<InvoiceStatus>(['issued', 'partially_paid', 'overdue']);
export const MAX_DUNNING_ATTEMPTS = 12;   // hard ceiling — past this, escalate to suspension, don't keep chasing

export function isDunnable(status: InvoiceStatus): boolean { return DUNNABLE.has(status); }

/** Validate the invoice can be dunned and compute the next attempt number. Throws InvalidDunningError otherwise. */
export function nextDunningAttempt(status: InvoiceStatus, currentAttempts: number): number {
  if (!isDunnable(status)) throw new InvalidDunningError(`invoice in status '${status}' is not dunnable`);
  const next = currentAttempts + 1;
  if (next > MAX_DUNNING_ATTEMPTS) throw new InvalidDunningError(`dunning cap reached (${MAX_DUNNING_ATTEMPTS}); escalate instead`);
  return next;
}
