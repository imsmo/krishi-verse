// core/rbac/permissions.guard.ts · canonical RBAC guard lives in core/auth.
// Re-exported here so either import path resolves to the same implementation.
export { PermissionsGuard, RequirePermissions, PERMISSIONS_KEY } from '../auth/permissions.guard';
