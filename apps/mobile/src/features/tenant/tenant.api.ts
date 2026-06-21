// apps/mobile/src/features/tenant/tenant.api.ts · data layer for tenant-admin-lite (P-17). Keeps screens thin
// (guide §3). Reads degrade-never-die (null/empty). Mutations (approve / resolve / add-farmer / apply / KYC
// review) are ONLINE transitions that throw so the screen shows the precise outcome (403 not-allowed, 409 illegal)
// — the SERVER authorizes every action against the tenant admin's OWN permissions (NOT god-mode, Law 11).
// add-farmer + apply carry an Idempotency-Key (Law 3). Money is bigint minor strings (Law 2).
import type { Plan, Subscription, RoleAssignment, Dispute, UserProfile, ListingCard, PayoutSummary } from '@krishi-verse/sdk-js';
import { apiClient } from '../../core/api/client';
import { newId } from '../../core/util/ids';

export interface DisputesPage { items: Dispute[]; nextCursor: string | null }
export interface ListingsPage { items: ListingCard[]; nextCursor: string | null }
export interface PayoutsPage { items: PayoutSummary[]; nextCursor: string | null }

// --- subscription / plans (06 apply / 07 pending) ---
export async function plans(): Promise<Plan[]> {
  try { return await apiClient().tenancy.plans(); } catch { return []; }
}
export async function currentSubscription(): Promise<Subscription | null> {
  try { return (await apiClient().tenancy.currentSubscription()).subscription; } catch { return null; }
}
export function applyForPlan(planId: string, billingCycle?: 'monthly' | 'annual'): Promise<Subscription> {
  return apiClient().tenancy.apply({ planId, billingCycle }, newId());
}

// --- roster + approvals (76 farmers / 147 approvals) ---
export async function assignments(opts: { roleCode?: string; pendingOnly?: boolean } = {}): Promise<RoleAssignment[]> {
  try { return await apiClient().rbac.assignments(opts); } catch { return []; }
}
export function approveAssignment(id: string): Promise<{ ok: boolean }> {
  return apiClient().rbac.approveAssignment(id);
}

// --- users (77 farmer-detail / 78 add-farmer) ---
export async function getUser(id: string): Promise<UserProfile | null> {
  try { return await apiClient().users.get(id); } catch { return null; }
}
export function addFarmer(input: { phone: string; fullName?: string }): Promise<UserProfile> {
  return apiClient().users.create(input, newId());
}

// --- KYC review (148 approve-detail) ---
export function reviewKyc(id: string, decision: 'verify' | 'reject', reason?: string): Promise<{ id: string; status: string }> {
  return apiClient().kyc.review(id, { decision, reason });
}

// --- disputes (155/156) ---
export async function disputesList(status?: string, cursor?: string): Promise<DisputesPage> {
  try { return await apiClient().disputes.list({ box: 'all', status, cursor }); } catch { return { items: [], nextCursor: null }; }
}
export async function getDispute(id: string): Promise<Dispute | null> {
  try { return await apiClient().disputes.get(id); } catch { return null; }
}
export function reviewDispute(id: string): Promise<Dispute> { return apiClient().disputes.review(id); }
export function escalateDispute(id: string): Promise<Dispute> { return apiClient().disputes.escalate(id); }
export function resolveDispute(id: string, body: { resolutionType: string; resolutionAmountMinor?: string; note?: string }): Promise<Dispute> {
  return apiClient().disputes.resolve(id, body);
}

// --- monitoring (79 listings / 80 payouts). Read-only; tenant-scoped server-side. Degrade to empty. ---
export async function tenantListings(cursor?: string): Promise<ListingsPage> {
  try { return await apiClient().listings.browse({ cursor }); } catch { return { items: [], nextCursor: null }; }
}
export async function tenantPayouts(cursor?: string): Promise<PayoutsPage> {
  try { return await apiClient().payouts.list(cursor); } catch { return { items: [], nextCursor: null }; }
}
