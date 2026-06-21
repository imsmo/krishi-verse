// @krishi-verse/sdk-js · labour resource (module 6 — the worker marketplace). Worker self-service: register +
// view/update OWN profile (the server scopes to the caller — userId is never client-supplied); browse OPEN
// bookings (jobs); list + respond to OWN assignments (job offers) within the booking's accept/decline window
// (server-enforced). `age_verified_18` is NOT settable here — it's verified out-of-band (KYC) and the server
// hard-gates accepting work on it. register carries an Idempotency-Key (Law 3). Money is bigint minor strings
// (Law 2). Gated server-side by the `labour` flag.
import { HttpClient } from '../http';
import { WorkerProfile, LabourBooking, LabourAssignment, Page } from '../types';

export interface WorkerPrefsInput {
  villageRegionId?: string; travelKm?: number; stayAwayOk?: 'same_day' | 'overnight' | 'weekly' | 'monthly';
  minWageExpectationMinor?: string; autoAcceptAboveMinor?: string; hasSmartphone?: boolean;
  emergencyContactName?: string; emergencyContactPhone?: string; eshramNo?: string;
}

export class LabourResource {
  constructor(private readonly http: HttpClient) {}

  // --- worker profile (self) ---
  async registerWorker(input: WorkerPrefsInput, idempotencyKey: string): Promise<WorkerProfile> {
    return (await this.http.request<WorkerProfile>('POST', 'labour/workers', { idempotencyKey, body: input })).data;
  }
  /** The caller's own worker profile, or { worker: null } if not yet registered. */
  async myWorker(signal?: AbortSignal): Promise<{ worker: WorkerProfile | null }> {
    return (await this.http.request<{ worker: WorkerProfile | null }>('GET', 'labour/workers/me', { signal })).data;
  }
  async updateWorker(patch: WorkerPrefsInput): Promise<WorkerProfile> {
    return (await this.http.request<WorkerProfile>('PATCH', 'labour/workers/me', { body: patch })).data;
  }

  // --- jobs (bookings) ---
  /** Browse jobs. `box=open` = the marketplace of open bookings (for workers). Keyset. */
  async listBookings(params: { box?: 'mine' | 'open' | 'all'; status?: string; taskSkillId?: string; cursor?: string; limit?: number } = {}, signal?: AbortSignal): Promise<Page<LabourBooking>> {
    const r = await this.http.request<LabourBooking[]>('GET', 'labour/bookings', { query: { box: params.box ?? 'open', status: params.status, taskSkillId: params.taskSkillId, cursor: params.cursor, limit: params.limit ?? 50 }, signal });
    return { items: r.data, nextCursor: (r.meta?.nextCursor as string | null) ?? null };
  }
  async getBooking(id: string, signal?: AbortSignal): Promise<LabourBooking> {
    return (await this.http.request<LabourBooking>('GET', `labour/bookings/${encodeURIComponent(id)}`, { signal })).data;
  }

  // --- assignments (the worker's job offers) ---
  /** `box=mine` = the caller worker's assignments. Keyset. */
  async listAssignments(params: { box?: 'mine' | 'booking'; bookingId?: string; status?: string; cursor?: string; limit?: number } = {}, signal?: AbortSignal): Promise<Page<LabourAssignment>> {
    const r = await this.http.request<LabourAssignment[]>('GET', 'labour/assignments', { query: { box: params.box ?? 'mine', bookingId: params.bookingId, status: params.status, cursor: params.cursor, limit: params.limit ?? 50 }, signal });
    return { items: r.data, nextCursor: (r.meta?.nextCursor as string | null) ?? null };
  }
  async getAssignment(id: string, signal?: AbortSignal): Promise<LabourAssignment> {
    return (await this.http.request<LabourAssignment>('GET', `labour/assignments/${encodeURIComponent(id)}`, { signal })).data;
  }
  /** Accept or reject an assignment (the caller's own). The server enforces the booking's respond-by window. */
  async respondAssignment(id: string, decision: 'accept' | 'reject', voiceConsentMediaId?: string): Promise<LabourAssignment> {
    return (await this.http.request<LabourAssignment>('POST', `labour/assignments/${encodeURIComponent(id)}/respond`, { body: { decision, voiceConsentMediaId } })).data;
  }
}
