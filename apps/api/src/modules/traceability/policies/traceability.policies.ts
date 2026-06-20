// modules/traceability/policies/traceability.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded 0004).
//   trace.manage — create traceable lots + append journey events + read any lot in-tenant (farmer field staff /
//   ops). A farmer reads their OWN lots with only authentication. The PUBLIC QR scan needs NO auth at all (the
//   unguessable qr_token is the capability) and returns a curated, non-PII projection only.
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const TracePermissions = { Manage: 'trace.manage' } as const;
export const canManageTrace = (ctx: RequestContext) => ctx.permissions.has('trace.manage') || ctx.permissions.has('*');
