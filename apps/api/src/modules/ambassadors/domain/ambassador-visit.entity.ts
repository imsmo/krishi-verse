// modules/ambassadors/domain/ambassador-visit.entity.ts · a geo-stamped field visit (PRD §16.10 field-ops).
// PURE: no I/O. The ambassador is always the actor; the visited party may be a prospect (no user yet), so
// visitedUserId is nullable. Raises a domain event on log so analytics/activity audits can react via the outbox.
import { AmbassadorEventType, DomainEvent } from './ambassadors.events';

export const VISIT_PURPOSES = ['onboarding', 'training', 'collection', 'followup', 'support', 'other'] as const;
export type VisitPurpose = (typeof VISIT_PURPOSES)[number];

export interface AmbassadorVisitProps {
  id: string; tenantId: string; ambassadorId: string; visitedUserId: string | null;
  purpose: VisitPurpose; notes: string | null; lat: number | null; lng: number | null;
  regionId: string | null; visitedAt: Date; createdAt?: Date;
}

export class AmbassadorVisit {
  private readonly events: DomainEvent[] = [];
  private constructor(private readonly props: AmbassadorVisitProps) {}

  static log(input: Omit<AmbassadorVisitProps, 'createdAt'>): AmbassadorVisit {
    const v = new AmbassadorVisit(input);
    v.events.push({ type: AmbassadorEventType.VisitLogged, payload: { visitId: v.props.id, ambassadorId: v.props.ambassadorId, visitedUserId: v.props.visitedUserId, purpose: v.props.purpose } });
    return v;
  }
  static rehydrate(props: AmbassadorVisitProps): AmbassadorVisit { return new AmbassadorVisit(props); }

  get id() { return this.props.id; }
  toProps(): AmbassadorVisitProps { return { ...this.props }; }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
  toJSON() {
    const p = this.props;
    return { id: p.id, ambassadorId: p.ambassadorId, visitedUserId: p.visitedUserId, purpose: p.purpose,
      notes: p.notes, lat: p.lat, lng: p.lng, regionId: p.regionId, visitedAt: p.visitedAt, createdAt: p.createdAt };
  }
}
