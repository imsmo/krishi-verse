// core/bulk/policies/bulk.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded 0004).
//   bulk.import — create + manage bulk CSV import jobs (an admin operation; granted to tenant_admin).
import { RequestContext } from '../../tenancy-context/request-context';
export const BulkPermissions = { Import: 'bulk.import' } as const;
export const canBulkImport = (ctx: RequestContext) => ctx.permissions.has('bulk.import') || ctx.permissions.has('*');
