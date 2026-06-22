// modules/tenancy/domain/tenant.state.ts · the tenant_status vocabulary as seen by the IN-TENANT self-serve plane.
// Mirrors the tenant_status enum in db/migrations/0002. IMPORTANT (Law 11): the AUTHORITATIVE lifecycle state
// machine — who may move pending→trial→active→grace→suspended→archived→terminated — lives in apps/admin-api
// (modules/tenant-ops/domain/tenant.state.ts), the god-mode plane. Here we only CLASSIFY a tenant's status for
// read/guard purposes; this module never transitions status. Keeping the enum in sync is asserted in tests.
export const TENANT_STATUSES = ['pending', 'trial', 'active', 'grace', 'suspended', 'archived', 'terminated'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

/** Live = the tenant can transact (its admins may self-serve manage profile/domains/settings). */
export function isLive(s: TenantStatus): boolean { return s === 'trial' || s === 'active' || s === 'grace'; }
/** Terminal = nothing more can change; self-serve writes are refused. */
export function isTerminal(s: TenantStatus): boolean { return s === 'terminated'; }
/** Pending = awaiting god-mode approval; the tenant may still complete/submit its onboarding profile. */
export function isPending(s: TenantStatus): boolean { return s === 'pending'; }
/** Self-serve profile/domain/setting writes are allowed only while the tenant is pending or live. */
export function allowsSelfServeWrites(s: TenantStatus): boolean { return isPending(s) || isLive(s); }
