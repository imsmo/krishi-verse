// apps/admin-api/src/modules/compliance-ops/domain/export-approval.ts · pure guard for the data-export approval
// gate. A tenant full-export / DPDP portability bundle is a major data-egress (potential mass-PII exfil), so it
// stays approval_status='pending' until platform compliance approves it; only then does the worker run it. An
// already-decided job (approved/rejected) cannot be re-decided (idempotent-safe; else a typed 409).
import { ExportAlreadyDecidedError } from './compliance-ops.errors';

export type ExportDecision = 'approve' | 'reject';

/** Returns the next approval_status, or throws if the job was already decided. */
export function decideExport(current: string, decision: ExportDecision): 'approved' | 'rejected' {
  if (current !== 'pending') throw new ExportAlreadyDecidedError(current);
  return decision === 'approve' ? 'approved' : 'rejected';
}
