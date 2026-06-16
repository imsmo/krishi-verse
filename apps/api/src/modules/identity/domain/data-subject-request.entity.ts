// modules/identity/domain/data-subject-request.entity.ts · DPDP rights workflow (access/erase/etc).
import { DomainError } from '../../../shared/errors/app-error';
export type DsrType = 'access' | 'erasure' | 'correction' | 'portability';
export type DsrStatus = 'open' | 'in_progress' | 'completed' | 'rejected';
export interface DsrProps {
  id: string; userId: string; requestType: DsrType; status: DsrStatus;
  coolingEndsAt: Date | null; resolution: string | null; exportMediaId: string | null;
}
const NEXT: Record<DsrStatus, DsrStatus[]> = { open: ['in_progress','rejected'], in_progress: ['completed','rejected'], completed: [], rejected: [] };
export class DataSubjectRequest {
  private constructor(private props: DsrProps) {}
  static open(input: { id: string; userId: string; requestType: DsrType }): DataSubjectRequest {
    // Erasure has a 90-day cooling-off (regulatory + abuse protection).
    const coolingEndsAt = input.requestType === 'erasure' ? new Date(Date.now() + 90 * 86400_000) : null;
    return new DataSubjectRequest({ ...input, status: 'open', coolingEndsAt, resolution: null, exportMediaId: null });
  }
  static rehydrate(p: DsrProps): DataSubjectRequest { return new DataSubjectRequest(p); }
  get id() { return this.props.id; }
  toProps(): Readonly<DsrProps> { return Object.freeze({ ...this.props }); }
  transition(to: DsrStatus, resolution?: string): void {
    if (!NEXT[this.props.status].includes(to)) throw new DomainError('DSR_ILLEGAL_TRANSITION', `Cannot move DSR ${this.props.status}→${to}`, 409);
    this.props.status = to; if (resolution) this.props.resolution = resolution;
  }
}
