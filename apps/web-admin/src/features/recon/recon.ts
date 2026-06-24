// apps/web-admin/src/features/recon/recon.ts · PURE, framework-free helpers + types for the god-mode money-safety
// (reconciliation) console. No fetch, no React → unit-tested. The investigation state machine MIRRORS admin-api's
// investigation.state (Law 5 — the server is authoritative; this only decides which actions to SHOW, and a raced/
// illegal move degrades to a 409 message). Money totals are bigint MINOR-UNIT STRINGS (rendered by the caller via
// formatMoneyMinor — never floated). No money is ever entered here (recon never posts the ledger).

export const INVESTIGATION_STATUSES = ['open', 'investigating', 'resolved', 'false_positive'] as const;
export type InvestigationStatus = (typeof INVESTIGATION_STATUSES)[number];
export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

// Mirrors admin-api investigation.state TRANSITIONS exactly.
const TRANSITIONS: Readonly<Record<InvestigationStatus, readonly InvestigationStatus[]>> = {
  open: ['investigating', 'resolved', 'false_positive'],
  investigating: ['resolved', 'false_positive', 'open'],
  resolved: [],
  false_positive: [],
};
export function canTransition(from: InvestigationStatus, to: InvestigationStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
export function isTerminal(s: InvestigationStatus): boolean { return s === 'resolved' || s === 'false_positive'; }

// The three UPDATE actions (PATCH investigations/:id) surfaced only when legal.
export function canStart(s: InvestigationStatus): boolean { return s === 'open'; }                       // → investigating
export function canResolve(s: InvestigationStatus): boolean { return canTransition(s, 'resolved'); }      // open|investigating
export function canFalsePositive(s: InvestigationStatus): boolean { return canTransition(s, 'false_positive'); }

export function investigationStatusKey(s: string | null | undefined): InvestigationStatus {
  return (INVESTIGATION_STATUSES as readonly string[]).includes(s ?? '') ? (s as InvestigationStatus) : 'open';
}
export function severityKey(s: string | null | undefined): Severity {
  return (SEVERITIES as readonly string[]).includes(s ?? '') ? (s as Severity) : 'high';
}

/** Mandatory audit reason / summary / note (min 3, max 1000) — mirrors the zod Reason. */
export function validReason(r: string | null | undefined): boolean {
  const v = (r ?? '').trim();
  return v.length >= 3 && v.length <= 1000;
}

// ---- read-model shapes (mirror admin-api recon-monitor read models; type-only, no runtime) ----
export interface ReconOverview {
  latestByType: { runType: string; status: string; checkedCount: number; mismatchCount: number; finishedAt: string | null }[];
  ledgerZeroSum: { sumMinor: string; balanced: boolean };
}
export interface ReconRunRow { id: string; runType: string; status: string; checkedCount: number; mismatchCount: number; periodStart: string | null; periodEnd: string | null; finishedAt: string | null; createdAt: string | null }
export interface ReconRunDetail extends ReconRunRow { mismatches: unknown[] }
export interface WalletAccount { id: string; ownerKind: string; accountCode: string; currency: string; balanceMinor: string; isFrozen: boolean; freezeReason: string | null; shardNo: number | null }
export interface Investigation { id: string; runId: string; status: InvestigationStatus; severity: Severity; summary: string; assignedTo: string | null; resolutionNote: string | null; openedBy: string; resolvedAt: string | null; createdAt: string | null }
