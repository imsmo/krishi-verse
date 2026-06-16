// core/audit/audit.decorator.ts
// @Audited('action.code') marks a handler as auditable (metadata for tooling/review).
// The RELIABLE audit write is done explicitly by services inside the transaction via
// AuditWriter.write(tx, …) — decorators can't guarantee in-tx atomicity. This marker
// lets us assert in CI that every admin/state-changing endpoint is covered.
import { SetMetadata } from '@nestjs/common';
export const AUDIT_ACTION_KEY = 'audit_action';
export const Audited = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);
