// core/tenancy-context/tenant-resolver.ts
// Verifies the access token and extracts the caller's identity + grants. Tokens
// are minted by the auth/OTP flow and carry: sub (user id), tid (tenant id),
// roles, perms (flattened permission keys; '*' = platform god-mode). Returns null
// when no/invalid token (anonymous) so the middleware can still serve public reads.
import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AppConfig } from '../config/app-config';

export interface ResolvedPrincipal {
  userId: string; tenantId: string; roles: string[]; permissions: string[];
}

@Injectable()
export class TenantResolver {
  constructor(private readonly config: AppConfig) {}

  fromAuthHeader(authHeader?: string): ResolvedPrincipal | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice('Bearer '.length).trim();
    try {
      const { accessSecret, issuer } = this.config.jwt;
      const claims = jwt.verify(token, accessSecret, { issuer }) as jwt.JwtPayload;
      return {
        userId: String(claims.sub ?? ''),
        tenantId: String((claims as any).tid ?? ''),
        roles: Array.isArray((claims as any).roles) ? (claims as any).roles : [],
        permissions: Array.isArray((claims as any).perms) ? (claims as any).perms : [],
      };
    } catch {
      return null; // invalid/expired token ⇒ treated as anonymous; protected routes 401 at AuthGuard
    }
  }
}
