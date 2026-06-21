// apps/mobile/src/features/labour/labour.api.ts · data layer for the worker app (P-12). Keeps screens thin
// (guide §3). Reads degrade-never-die (null/empty). Register is idempotent (Law 3). Respond (accept/decline) is an
// online transition that throws so the screen shows the precise outcome (409 window-expired / 403 not-allowed) —
// the server enforces the accept/decline window + the 18+ gate. Money is bigint minor strings (Law 2).
import type { WorkerProfile, LabourBooking, LabourAssignment, WorkerPrefsInput } from '@krishi-verse/sdk-js';
import { apiClient } from '../../core/api/client';
import { newId } from '../../core/util/ids';

export interface JobsPage { items: LabourBooking[]; nextCursor: string | null }
export interface OffersPage { items: LabourAssignment[]; nextCursor: string | null }

export async function getMyWorker(): Promise<WorkerProfile | null> {
  try { return (await apiClient().labour.myWorker()).worker; } catch { return null; }
}
export function registerWorker(input: WorkerPrefsInput): Promise<WorkerProfile> {
  return apiClient().labour.registerWorker(input, newId());
}
export function updateWorker(patch: WorkerPrefsInput): Promise<WorkerProfile> {
  return apiClient().labour.updateWorker(patch);
}
/** Browse OPEN jobs (the marketplace). Degrades to an empty page. */
export async function browseJobs(cursor?: string): Promise<JobsPage> {
  try { return await apiClient().labour.listBookings({ box: 'open', cursor }); } catch { return { items: [], nextCursor: null }; }
}
export async function getJob(id: string): Promise<LabourBooking | null> {
  try { return await apiClient().labour.getBooking(id); } catch { return null; }
}
/** The worker's own assignments (job offers). Degrades to an empty page. */
export async function myOffers(status?: string, cursor?: string): Promise<OffersPage> {
  try { return await apiClient().labour.listAssignments({ box: 'mine', status, cursor }); } catch { return { items: [], nextCursor: null }; }
}
export async function getOffer(id: string): Promise<LabourAssignment | null> {
  try { return await apiClient().labour.getAssignment(id); } catch { return null; }
}
/** Accept/decline an offer within the server-enforced window. Throws on a real error. */
export function respondOffer(id: string, decision: 'accept' | 'reject'): Promise<LabourAssignment> {
  return apiClient().labour.respondAssignment(id, decision);
}
