// apps/admin-api/src/modules/compliance-ops/domain/dsr.entity.ts · the data-subject-request entity. Pure domain,
// no I/O. Status moves go ONLY through dsr.state.ts (Law 5); each transition returns {from,to} for the audit.
// DPDP guard: an ERASURE may not be COMPLETED while its 90-day cooling window is still open (cooling_ends_at in
// the future) — the data principal can still withdraw. Mirrors data_subject_requests (0003).
import { DsrStatus, assertTransition, isTerminal } from './dsr.state';
import { ErasureCoolingActiveError } from './compliance-ops.errors';

export interface DsrProps {
  id: string;
  userId: string;
  requestType: 'access' | 'erasure' | 'correction' | 'portability';
  status: DsrStatus;
  coolingEndsAt: Date | null;
  resolution: string | null;
  exportMediaId: string | null;
  createdAt?: Date | null;
}

export class DataSubjectRequest {
  private constructor(private props: DsrProps) {}
  static rehydrate(p: DsrProps): DataSubjectRequest { return new DataSubjectRequest(p); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  get requestType() { return this.props.requestType; }

  private move(to: DsrStatus): { from: DsrStatus; to: DsrStatus } {
    const from = this.props.status;
    assertTransition(from, to);
    this.props.status = to;
    return { from, to };
  }

  startProgress(): { from: DsrStatus; to: DsrStatus } { return this.move('in_progress'); }

  /** Complete the request. For an erasure, the 90-day cooling window must have elapsed (DPDP). */
  complete(resolution: string, now: Date = new Date()): { from: DsrStatus; to: DsrStatus } {
    if (this.props.requestType === 'erasure' && this.props.coolingEndsAt && this.props.coolingEndsAt > now) {
      throw new ErasureCoolingActiveError(this.props.coolingEndsAt.toISOString());
    }
    const c = this.move('completed');
    this.props.resolution = resolution;
    return c;
  }

  reject(resolution: string): { from: DsrStatus; to: DsrStatus } {
    const c = this.move('rejected');
    this.props.resolution = resolution;
    return c;
  }

  /** Link the fulfilment export (access/portability bundle) produced by the worker. */
  attachExportMedia(mediaId: string): void { this.props.exportMediaId = mediaId; }

  get resolution() { return this.props.resolution; }
  get isTerminal() { return isTerminal(this.props.status); }

  toJSON() {
    const v = this.props;
    return { id: v.id, userId: v.userId, requestType: v.requestType, status: v.status,
      coolingEndsAt: v.coolingEndsAt, resolution: v.resolution, exportMediaId: v.exportMediaId, createdAt: v.createdAt ?? null };
  }
}
