// core/auth/jwt.strategy.ts
// We verify access tokens in the tenant-context middleware (via TenantResolver →
// TokenService) rather than a per-route Passport strategy — one verification path,
// and the ambient RequestContext is available to every layer. This file is kept as
// the canonical import point for token verification.
export { TokenService, TOKEN_SERVICE } from './token.service';
export type { AccessTokenClaims } from './token.service';
