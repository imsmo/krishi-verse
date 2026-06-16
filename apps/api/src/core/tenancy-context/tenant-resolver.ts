// core/tenancy-context/tenant-resolver.ts
// Verifies the access token (via TokenService — the single verification path) and
// extracts the caller's identity + server-resolved grants. The token's roles/perms
// were resolved from the DB (RoleCache) at login/refresh and signed; the client
// cannot inject its own. Returns null when no/invalid token (anonymous) so the
// middleware can still serve @Public reads.
import { Injectable } from '@nestjs/common';
import { TokenService } from '../auth/token.service';

export interface ResolvedPrincipal {
  userId: string; tenantId: string; sessionId: string; roles: string[]; permissions: string[];
}

@Injectable()
export class TenantResolver {
  constructor(private readonly tokens: TokenService) {}

  fromAuthHeader(authHeader?: string): ResolvedPrincipal | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const c = this.tokens.verifyAccessToken(authHeader.slice('Bearer '.length).trim());
    if (!c || !c.sub) return null;
    return { userId: c.sub, tenantId: c.tid, sessionId: c.sid, roles: c.roles, permissions: c.perms };
  }
}
