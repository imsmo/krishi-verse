// modules/labour/domain/worker-profile.entity.ts · the worker_profiles aggregate (pure domain, no I/O).
// A worker self-registers ONE profile (user_id UNIQUE). age_verified_18 is a HARD booking gate (Law: the
// app refuses to assign an unverified worker). Money fields are bigint minor units (Law 2).
import { LabourEventType, DomainEvent } from './labour.events';
import { WorkerNotAgeVerifiedError } from './labour.errors';

export interface WorkerProfileProps {
  id: string;
  userId: string;
  tenantId: string;
  onboardedBy: string | null;
  ageVerified18: boolean;
  villageRegionId: string | null;
  travelKm: number;
  stayAwayOk: string;            // same_day|overnight|weekly|monthly
  minWageExpectationMinor: bigint | null;
  autoAcceptAboveMinor: bigint | null;
  hasSmartphone: boolean;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  eshramNo: string | null;
  ratingAvg: number | null;
  bookingsCompleted: number;
  noShowCount: number;
  createdAt?: Date;
}

export class WorkerProfile {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: WorkerProfileProps) {}

  static register(input: {
    id: string; userId: string; tenantId: string; onboardedBy: string | null;
    villageRegionId?: string | null; travelKm?: number; stayAwayOk?: string;
    minWageExpectationMinor?: bigint | null; autoAcceptAboveMinor?: bigint | null; hasSmartphone?: boolean;
    emergencyContactName?: string | null; emergencyContactPhone?: string | null; eshramNo?: string | null;
  }): WorkerProfile {
    const w = new WorkerProfile({
      id: input.id, userId: input.userId, tenantId: input.tenantId, onboardedBy: input.onboardedBy,
      ageVerified18: false,
      villageRegionId: input.villageRegionId ?? null,
      travelKm: input.travelKm ?? 10,
      stayAwayOk: input.stayAwayOk ?? 'same_day',
      minWageExpectationMinor: input.minWageExpectationMinor ?? null,
      autoAcceptAboveMinor: input.autoAcceptAboveMinor ?? null,
      hasSmartphone: input.hasSmartphone ?? true,
      emergencyContactName: input.emergencyContactName ?? null,
      emergencyContactPhone: input.emergencyContactPhone ?? null,
      eshramNo: input.eshramNo ?? null,
      ratingAvg: null, bookingsCompleted: 0, noShowCount: 0,
    });
    w.events.push({ type: LabourEventType.WorkerRegistered, payload: { workerId: w.props.id, userId: w.props.userId } });
    return w;
  }
  static rehydrate(props: WorkerProfileProps): WorkerProfile { return new WorkerProfile(props); }

  get id() { return this.props.id; }
  get userId() { return this.props.userId; }
  get tenantId() { return this.props.tenantId; }
  get isAgeVerified() { return this.props.ageVerified18; }
  toProps(): Readonly<WorkerProfileProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  /** HARD RULE: throws unless the worker is age-verified (18+). Called before any assignment. */
  assertAssignable(): void { if (!this.props.ageVerified18) throw new WorkerNotAgeVerifiedError(this.props.id); }

  /** Worker edits their own preferences (not identity/age — age is verified out-of-band by admin/KYC). */
  updatePreferences(patch: Partial<Pick<WorkerProfileProps,
    'villageRegionId' | 'travelKm' | 'stayAwayOk' | 'minWageExpectationMinor' | 'autoAcceptAboveMinor' |
    'hasSmartphone' | 'emergencyContactName' | 'emergencyContactPhone' | 'eshramNo'>>): void {
    let changed = false;
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      (this.props as any)[k] = v; changed = true;
    }
    if (changed) this.events.push({ type: LabourEventType.WorkerUpdated, payload: { workerId: this.props.id } });
  }
}
