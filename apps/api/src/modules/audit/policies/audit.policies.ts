// modules/audit/policies/audit.policies.ts · permission keys (DB-backed RBAC, Law 6).
//   audit.read — a tenant auditor/accountant (or tenant_admin): READ the append-only audit trail.
// There is no write path here — the trail is written only by core/audit AuditWriter, inside business
// transactions; this module is strictly read-only (CQRS, Law 12).
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const AuditPermissions = { Read: 'audit.read' } as const;
export const canReadAudit = (ctx: RequestContext) => ctx.permissions.has('audit.read') || ctx.permissions.has('*');
