// modules/land-soil-weather/domain/soil-test.entity.ts · the soil_tests aggregate (Soil Health Card linkage).
// Opaque results jsonb (ph/ec/oc/n/p/k…), recommendations, validity. Append-only record. No money.
import { DomainEvent, LandEventType } from './land-soil-weather.events';
import { InvalidSoilTestError } from './land-soil-weather.errors';

export interface SoilTestProps {
  id: string; tenantId: string; parcelId: string; labName: string | null; shcCardNo: string | null; sampledOn: string;
  results: Record<string, unknown>; recommendations: Record<string, unknown>; reportMediaId: string | null; validUntil: string | null; createdAt?: Date;
}
export class SoilTest {
  private readonly events: DomainEvent[] = [];
  private constructor(private readonly props: SoilTestProps) {}
  static record(input: SoilTestProps): SoilTest {
    if (!input.sampledOn) throw new InvalidSoilTestError('sampled date required');
    if (!input.results || typeof input.results !== 'object' || Object.keys(input.results).length === 0) throw new InvalidSoilTestError('results required');
    const t = new SoilTest(input);
    t.events.push({ type: LandEventType.SoilTestRecorded, payload: { soilTestId: t.props.id, parcelId: t.props.parcelId } });
    return t;
  }
  static rehydrate(props: SoilTestProps): SoilTest { return new SoilTest(props); }
  get id() { return this.props.id; }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
  toProps(): Readonly<SoilTestProps> { return Object.freeze({ ...this.props }); }
  toJSON() { const v = this.props; return { id: v.id, parcelId: v.parcelId, labName: v.labName, shcCardNo: v.shcCardNo, sampledOn: v.sampledOn, results: v.results, recommendations: v.recommendations, reportMediaId: v.reportMediaId, validUntil: v.validUntil, createdAt: v.createdAt }; }
}
