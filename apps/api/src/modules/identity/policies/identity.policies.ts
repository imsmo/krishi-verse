// modules/identity/policies/identity.policies.ts · permission keys for the identity surface.
// These string keys are seeded into the permissions table (db/seeds 0004) and granted
// to roles there (dynamic RBAC, Law 6). Self-service endpoints need no permission (the
// caller acts on their own resources); admin endpoints require these.
export const IdentityPermissions = {
  Approve: 'user.approve',        // approve users/roles, review KYC, change status
  Impersonate: 'user.impersonate',
  Report: 'report.view',          // list/inspect users in a tenant
  TenantSettings: 'tenant.settings',
} as const;
