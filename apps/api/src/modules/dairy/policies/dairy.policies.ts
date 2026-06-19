// modules/dairy/policies/dairy.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded in 0004).
//   dairy.manage — the cooperative/MCC operator: create MCCs + rate cards, enrol members, record
//                  collections, generate/approve/PAY milk bills. Members READ their own data (no perm).
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const DairyPermissions = { Manage: 'dairy.manage' } as const;
export const canManageDairy = (ctx: RequestContext) => ctx.permissions.has('dairy.manage') || ctx.permissions.has('*');
