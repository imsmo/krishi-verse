// apps/mobile/src/features/tenant/tenant-admin.ts · PURE tenant-admin-lite logic for P-17. No React/native (SDK/ui
// types are `import type` → erased) → unit-tested. THE APP IS NOT GOD-MODE (Law 11): a tenant admin only acts
// within their own tenant and every action is authorized + re-checked SERVER-SIDE; these helpers only drive the
// UI (status tones, KPI counts from real lists, resolution options, add-farmer validation). Money is bigint
// minor strings (Law 2) — never floated here.
import type { PillTone } from '@krishi-verse/ui-native';
import type { RoleAssignment, Dispute, Subscription } from '@krishi-verse/sdk-js';

/** Subscription status → tone (drives apply/pending UX). */
export function subscriptionTone(status: string | undefined): PillTone {
  switch (status) {
    case 'active': return 'success';
    case 'trialing': case 'pending': return 'warning';
    case 'past_due': return 'danger';
    case 'cancelled': case 'expired': return 'neutral';
    default: return 'neutral';
  }
}

/** Whether the tenant still needs to apply / is awaiting activation (drives 06 apply vs 07 pending). */
export function needsToApply(sub: Pick<Subscription, 'status'> | null): boolean {
  return !sub;
}
export function isPending(sub: Pick<Subscription, 'status'> | null): boolean {
  return !!sub && (sub.status === 'pending' || sub.status === 'trialing');
}

/** A role assignment is awaiting approval when it isn't active and has no approval timestamp. */
export function isPendingApproval(a: Pick<RoleAssignment, 'isActive' | 'approvedAt'>): boolean {
  return !a.isActive && !a.approvedAt;
}

/** KYC/approval status → tone. */
export function approvalStatusTone(status: string): PillTone {
  switch (status) {
    case 'verified': case 'approved': case 'active': return 'success';
    case 'pending': case 'none': return 'warning';
    case 'rejected': case 'expired': return 'danger';
    default: return 'neutral';
  }
}

/** Dispute status → tone (moderation view). */
export function disputeStatusTone(status: string): PillTone {
  switch (status) {
    case 'resolved': case 'closed': return 'success';
    case 'under_review': case 'escalated': return 'accent';
    case 'open': case 'awaiting_seller': return 'warning';
    case 'rejected': case 'withdrawn': return 'neutral';
    default: return 'neutral';
  }
}

export type DisputeAction = 'review' | 'escalate' | 'resolve';
/** Which moderator actions apply to a dispute status (server re-checks legality). */
export function disputeActions(status: string): DisputeAction[] {
  switch (status) {
    case 'open': case 'awaiting_seller': return ['review'];
    case 'under_review': return ['escalate', 'resolve'];
    case 'escalated': return ['resolve'];
    default: return []; // resolved/closed/withdrawn — terminal
  }
}

/** The resolution choices a moderator can pick (UI list; the server validates the enum). */
export const RESOLUTION_OPTIONS = ['refund_full', 'refund_partial', 'replace', 'reject'] as const;
export type ResolutionOption = (typeof RESOLUTION_OPTIONS)[number];
// Single-shape result (not a discriminated union — so consumers narrow on `ok` without union-member access
// errors under tsc --noResolve): when ok, `body` is set; when not, `reason` is set.
export interface ResolutionResult { ok: boolean; body?: { resolutionType: string; resolutionAmountMinor?: string }; reason?: 'type' | 'amount' }
/** A partial refund requires an amount; others must NOT carry one. Returns the body or an error reason. */
export function buildResolution(type: string, rupees: string): ResolutionResult {
  if (!(RESOLUTION_OPTIONS as readonly string[]).includes(type)) return { ok: false, reason: 'type' };
  if (type === 'refund_partial') {
    const clean = (rupees ?? '').trim();
    if (!/^\d{1,13}$/.test(clean) || clean === '0') return { ok: false, reason: 'amount' };
    return { ok: true, body: { resolutionType: type, resolutionAmountMinor: (BigInt(clean) * 100n).toString() } };
  }
  return { ok: true, body: { resolutionType: type } };
}

export interface TenantKpis { farmers: number; pendingApprovals: number; openDisputes: number }
/** Compose dashboard KPIs from real lists the screen already fetched (no fabricated metrics endpoint). */
export function dashboardKpis(args: { assignments: RoleAssignment[]; disputes: Dispute[] }): TenantKpis {
  const farmers = (args.assignments ?? []).filter((a) => a.isActive).length;
  const pendingApprovals = (args.assignments ?? []).filter(isPendingApproval).length;
  const openDisputes = (args.disputes ?? []).filter((d) => !['resolved', 'closed', 'withdrawn', 'rejected'].includes(d.status)).length;
  return { farmers, pendingApprovals, openDisputes };
}

const E164 = /^\+?[1-9]\d{7,14}$/;
/** Validate the add-farmer form (phone required, E.164-ish; the server re-validates + normalizes). */
export function validateAddFarmer(form: { phone?: string; fullName?: string }): { ok: true; input: { phone: string; fullName?: string } } | { ok: false; reason: 'phone' } {
  const phone = (form.phone ?? '').trim().replace(/[\s-]/g, '');
  if (!E164.test(phone)) return { ok: false, reason: 'phone' };
  const fullName = (form.fullName ?? '').trim();
  return { ok: true, input: { phone, ...(fullName ? { fullName } : {}) } };
}
