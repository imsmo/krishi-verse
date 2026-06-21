// apps/mobile/src/features/profile/profile.api.ts · data layer for the profile/farm/bank/docs + help vertical
// (P-22). Keeps screens thin (guide §3). Reads degrade-never-die (null/empty). Writes hit the server and THROW so
// the screen shows the precise outcome: profile update (PATCH /users/me), parcel register + ticket open + bank add
// are idempotent (Law 3); CSAT is a simple rated write. Bank/KYC reads show masked data only — the app never holds
// a raw account number/Aadhaar (DPDP). Money n/a here. The server is the authority on KYC verification + SLA.
import type { UserProfile, SupportTicket, LandParcel, BankAccount, KycDocument } from '@krishi-verse/sdk-js';
import { apiClient } from '../../core/api/client';
import { newId } from '../../core/util/ids';
import type { ProfilePatch, TicketInput, ParcelInput } from './profile';

export interface TicketsPage { items: SupportTicket[]; nextCursor: string | null }
export interface ParcelsPage { items: LandParcel[]; nextCursor: string | null }

// --- profile ---
export async function getMyProfile(): Promise<UserProfile | null> {
  try { return await apiClient().users.me(); } catch { return null; }
}
export function updateMyProfile(patch: ProfilePatch): Promise<UserProfile> {
  return apiClient().users.updateMe(patch); // PATCH /users/me — throws on a real error
}

// --- farm parcels ---
export async function myParcels(cursor?: string): Promise<ParcelsPage> {
  try { return await apiClient().parcels.mine({ cursor }); } catch { return { items: [], nextCursor: null }; }
}
export function registerParcel(input: ParcelInput): Promise<LandParcel> {
  return apiClient().parcels.register(input, newId()); // idempotent (Law 3)
}

// --- bank accounts (list masked; add UPI) ---
export async function myBankAccounts(): Promise<BankAccount[]> {
  try { return await apiClient().bankAccounts.list(); } catch { return []; }
}
/** Add a UPI payout destination. A VPA is a public payment address (not a secret), so it is its own vaultRef —
 * full bank-account add needs a server-side tokenization step not exposed to mobile (flagged). Idempotent. */
export function addUpiAccount(input: { upiId: string; holderName?: string; isPrimary?: boolean }): Promise<BankAccount> {
  return apiClient().bankAccounts.add({ accountKind: 'upi', upiId: input.upiId, vaultRef: `upi:${input.upiId}`, holderName: input.holderName, isPrimary: input.isPrimary }, newId());
}

// --- documents (KYC) ---
export async function myDocuments(): Promise<KycDocument[]> {
  try { return await apiClient().kyc.list(); } catch { return []; }
}

// --- support tickets (help + complaint) ---
export async function myTickets(cursor?: string): Promise<TicketsPage> {
  try { return await apiClient().support.myTickets({ cursor }); } catch { return { items: [], nextCursor: null }; }
}
export async function getTicket(id: string): Promise<SupportTicket | null> {
  try { return await apiClient().support.get(id); } catch { return null; }
}
export function openTicket(input: TicketInput): Promise<SupportTicket> {
  return apiClient().support.open(input, newId()); // idempotent (Law 3)
}
export function rateTicket(id: string, score: number): Promise<SupportTicket> {
  return apiClient().support.submitCsat(id, score);
}
