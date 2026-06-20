// modules/cms/policies/cms.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded 0004).
//   cms.manage — author/publish/archive the tenant's CMS pages + manage its banners. Reading a PUBLISHED page
//   or a LIVE banner + recording a banner click need only authentication (no special permission). Platform
//   pages (tenant_id NULL) are not writable here (Law 11 — admin-api only).
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const CmsPermissions = { Manage: 'cms.manage' } as const;
export const canManageCms = (ctx: RequestContext) => ctx.permissions.has('cms.manage') || ctx.permissions.has('*');
