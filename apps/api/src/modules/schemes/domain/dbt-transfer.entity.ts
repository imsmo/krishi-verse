// modules/schemes/domain/dbt-transfer.entity.ts · the dbt_transfers aggregate (observed PFMS credit RECORD).
// PARTITIONED by created_at. amount_minor is bigint minor units (Law 2) — but NO in-platform wallet movement:
// the Direct Benefit Transfer is credited to the beneficiary's bank by the government PFMS; this row merely
// RECORDS the confirmed credit (pfms_ref) for the applicant's dashboard + reconciliation.
import { DomainEvent, SchemesEventType } from './schemes.events';
import { InvalidDbtError } from './schemes.errors';

export interface DbtTransferProps {
  id: string; tenantId: string | null; applicationId: string | null; userId: string; schemeId: string; amountMinor: bigint; instalmentNo: number | null; creditedOn: string; pfmsRef: string | null; createdAt?: Date;
}
export class DbtTransfer {
  private readonly events: DomainEvent[] = [];
  private constructor(private readonly props: DbtTransferProps) {}
  static record(input: DbtTransferProps): DbtTransfer {
    if (input.amountMinor <= 0n) throw new InvalidDbtError('DBT amount must be greater than zero');
    if (!input.creditedOn) throw new InvalidDbtError('credited date required');
    const t = new DbtTransfer(input);
    t.events.push({ type: SchemesEventType.DbtRecorded, payload: { dbtId: t.props.id, applicationId: t.props.applicationId, userId: t.props.userId, schemeId: t.props.schemeId, amountMinor: t.props.amountMinor.toString() } });
    return t;
  }
  static rehydrate(props: DbtTransferProps): DbtTransfer { return new DbtTransfer(props); }
  get id() { return this.props.id; }
  toProps(): Readonly<DbtTransferProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
  toJSON() { const v = this.props; return { id: v.id, applicationId: v.applicationId, userId: v.userId, schemeId: v.schemeId, amountMinor: v.amountMinor.toString(), instalmentNo: v.instalmentNo, creditedOn: v.creditedOn, pfmsRef: v.pfmsRef, createdAt: v.createdAt }; }
}
