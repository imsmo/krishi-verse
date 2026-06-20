// modules/schemes/domain/schemes.events.ts · integration events published by schemes (via outbox, Law 4).
export const SchemesEventType = {
  ApplicationSubmitted:    'schemes.application_submitted',
  ApplicationVerifying:    'schemes.application_verifying',
  ApplicationClarification:'schemes.application_clarification_needed',
  ApplicationApproved:     'schemes.application_approved',
  ApplicationRejected:     'schemes.application_rejected',
  ApplicationDisbursed:    'schemes.application_disbursed',
  ApplicationClosed:       'schemes.application_closed',
  ApplicationAppealed:     'schemes.application_appealed',
  DbtRecorded:             'schemes.dbt_recorded',
} as const;
export type DomainEvent = { type: string; payload: Record<string, unknown> };

/** The applicant attributes evaluated against a scheme's machine-readable eligibility_rules. */
export interface ApplicantProfile { roles?: string[]; landholdingAcres?: number; gender?: string; age?: number; }
