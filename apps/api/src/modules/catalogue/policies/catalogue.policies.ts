// modules/catalogue/policies/catalogue.policies.ts · permission keys (DB-backed RBAC, Law 6).
// Tenant-facing catalogue powers only. GLOBAL taxonomy (categories/attributes/platform
// products) is managed in apps/admin-api (Law 11) — not here.
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const CataloguePermissions = {
  ProductManage: 'product.manage',     // create/update a tenant's own (private) products + batches
  Configure: 'catalogue.configure',    // enable/disable categories for the tenant's storefront
  CertSubmit: 'certificate.submit',    // submit a certificate (organic/GI/lab) for a subject
  CertVerify: 'certificate.verify',    // moderator: verify/reject a submitted certificate
} as const;
export function canConfigure(ctx: RequestContext): boolean {
  return ctx.permissions.has(CataloguePermissions.Configure) || ctx.permissions.has('listing.moderate');
}
