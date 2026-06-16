// modules/identity/domain/consent.entity.ts · DPDP consent record (APPEND-ONLY history).
// Changing a consent is a NEW row, never an update — the full history is the audit trail.
export interface ConsentProps {
  id: string; userId: string; purposeCode: string; version: string; granted: boolean;
  channel: string; assistedBy: string | null;
}
export class Consent {
  constructor(readonly props: ConsentProps) {}
  static record(input: ConsentProps): Consent { return new Consent(input); }
}
