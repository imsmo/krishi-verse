// Unit tests for the PURE tenant-admin-lite logic (features/tenant/tenant-admin). Money built with BigInt (Law 2).
// The server is the authority on every action (no god-mode, Law 11); these helpers only drive the UI/validation.
import { subscriptionTone, needsToApply, isPending, isPendingApproval, disputeStatusTone, disputeActions, buildResolution, dashboardKpis, validateAddFarmer } from '../../features/tenant/tenant-admin';
import type { RoleAssignment, Dispute } from '@krishi-verse/sdk-js';

const asg = (over: Partial<RoleAssignment>): RoleAssignment => ({ id: 'a', userId: 'u', roleCode: 'farmer', kycStatus: 'pending', isActive: false, approvedAt: null, ...over });
const disp = (status: string): Dispute => ({ id: Math.random().toString(), orderId: 'o', raisedBy: 'r', againstUser: null, reasonId: null, description: null, status, sellerRespondBy: null, resolutionType: null, resolutionAmountMinor: null, resolvedBy: null, resolvedAt: null, slaDueAt: null } as Dispute);

describe('subscription helpers', () => {
  it('tones + apply/pending gating', () => {
    expect(subscriptionTone('active')).toBe('success');
    expect(subscriptionTone('past_due')).toBe('danger');
    expect(needsToApply(null)).toBe(true);
    expect(needsToApply({ status: 'active' })).toBe(false);
    expect(isPending({ status: 'pending' })).toBe(true);
    expect(isPending({ status: 'active' })).toBe(false);
  });
});

describe('approvals', () => {
  it('pending = not active + not approved', () => {
    expect(isPendingApproval({ isActive: false, approvedAt: null })).toBe(true);
    expect(isPendingApproval({ isActive: true, approvedAt: null })).toBe(false);
    expect(isPendingApproval({ isActive: false, approvedAt: '2026-01-01' })).toBe(false);
  });
});

describe('disputes', () => {
  it('status tones + action map', () => {
    expect(disputeStatusTone('resolved')).toBe('success');
    expect(disputeStatusTone('under_review')).toBe('accent');
    expect(disputeActions('open')).toEqual(['review']);
    expect(disputeActions('under_review')).toEqual(['escalate', 'resolve']);
    expect(disputeActions('escalated')).toEqual(['resolve']);
    expect(disputeActions('resolved')).toEqual([]);
  });
});

describe('buildResolution', () => {
  it('partial refund needs a positive amount → paise', () => {
    expect(buildResolution('refund_partial', '500')).toEqual({ ok: true, body: { resolutionType: 'refund_partial', resolutionAmountMinor: '50000' } });
    expect(buildResolution('refund_partial', '0')).toEqual({ ok: false, reason: 'amount' });
    expect(buildResolution('refund_partial', '')).toEqual({ ok: false, reason: 'amount' });
  });
  it('non-partial types carry no amount', () => {
    expect(buildResolution('refund_full', '999')).toEqual({ ok: true, body: { resolutionType: 'refund_full' } });
    expect(buildResolution('replace', '')).toEqual({ ok: true, body: { resolutionType: 'replace' } });
  });
  it('rejects an unknown type', () => {
    expect(buildResolution('nope', '')).toEqual({ ok: false, reason: 'type' });
  });
});

describe('dashboardKpis', () => {
  it('counts active farmers, pending approvals, open disputes', () => {
    const k = dashboardKpis({
      assignments: [asg({ isActive: true }), asg({ isActive: true }), asg({ isActive: false, approvedAt: null })],
      disputes: [disp('open'), disp('under_review'), disp('resolved'), disp('withdrawn')],
    });
    expect(k).toEqual({ farmers: 2, pendingApprovals: 1, openDisputes: 2 });
  });
});

describe('validateAddFarmer', () => {
  it('accepts an E.164-ish phone, trims spaces/dashes, keeps name', () => {
    expect(validateAddFarmer({ phone: ' +91 98123-45678 ', fullName: ' Asha ' })).toEqual({ ok: true, input: { phone: '+919812345678', fullName: 'Asha' } });
  });
  it('rejects a bad phone', () => {
    expect(validateAddFarmer({ phone: '123' })).toEqual({ ok: false, reason: 'phone' });
    expect(validateAddFarmer({})).toEqual({ ok: false, reason: 'phone' });
  });
});
