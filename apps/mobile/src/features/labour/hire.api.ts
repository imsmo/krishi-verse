// apps/mobile/src/features/labour/hire.api.ts · data layer for the EMPLOYER (farmer) hire vertical (P-14). Keeps
// screens thin (guide §3). Reads degrade-never-die (null/empty). Mutations (create/assign/start/complete/cancel/
// pay) are ONLINE transitions that throw so the screen shows the precise outcome (422 wage-below-floor, 403
// not-owner, 409 illegal-transition) — the server is the authority. create/assign/pay carry an Idempotency-Key
// (Law 3). Money is bigint minor strings (Law 2); the app never moves money — payWages signals the server (Law 11).
import type { WorkerProfile, LabourBooking, LabourAssignment, CreateBookingInput } from '@krishi-verse/sdk-js';
import { apiClient } from '../../core/api/client';
import { newId } from '../../core/util/ids';

export interface WorkersPage { items: WorkerProfile[]; nextCursor: string | null }
export interface BookingsPage { items: LabourBooking[]; nextCursor: string | null }

/** Browse the worker pool (PII-minimised). Degrades to an empty page. */
export async function browseWorkers(filter: { villageRegionId?: string; ageVerified?: boolean } = {}, cursor?: string): Promise<WorkersPage> {
  try { return await apiClient().labour.listWorkers({ ...filter, cursor }); } catch { return { items: [], nextCursor: null }; }
}
export async function getWorker(id: string): Promise<WorkerProfile | null> {
  try { return await apiClient().labour.getWorker(id); } catch { return null; }
}

/** The employer's own bookings (box=mine). Degrades to an empty page. */
export async function myBookings(status?: string, cursor?: string): Promise<BookingsPage> {
  try { return await apiClient().labour.listBookings({ box: 'mine', status, cursor }); } catch { return { items: [], nextCursor: null }; }
}
export async function getBooking(id: string): Promise<LabourBooking | null> {
  try { return await apiClient().labour.getBooking(id); } catch { return null; }
}
/** Assignments for a booking the caller owns (who accepted/declined). Degrades to []. */
export async function bookingAssignments(bookingId: string): Promise<LabourAssignment[]> {
  try { return (await apiClient().labour.bookingAssignments(bookingId)).items; } catch { return []; }
}

// --- mutations (throw on a real error) ---
export function createBooking(input: CreateBookingInput): Promise<LabourBooking> {
  return apiClient().labour.createBooking(input, newId());
}
export function assignWorker(bookingId: string, workerId: string, wageMinor?: string): Promise<LabourAssignment> {
  return apiClient().labour.assignWorker(bookingId, { workerId, wageMinor }, newId());
}
export function startBooking(bookingId: string): Promise<LabourBooking> { return apiClient().labour.startBooking(bookingId); }
export function completeBooking(bookingId: string): Promise<LabourBooking> { return apiClient().labour.completeBooking(bookingId); }
export function cancelBooking(bookingId: string, reason?: string): Promise<LabourBooking> { return apiClient().labour.cancelBooking(bookingId, reason); }
export function payWages(bookingId: string): Promise<LabourBooking> { return apiClient().labour.payWages(bookingId, newId()); }
