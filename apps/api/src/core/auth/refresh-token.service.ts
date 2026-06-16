// core/auth/refresh-token.service.ts
// Thin domain helper around refresh-token lifecycle so AuthService stays readable.
// Generation/hashing/compare live in TokenService (one crypto source of truth);
// this adds expiry computation + rotation semantics.
import { Injectable } from '@nestjs/common';
import { TokenService } from './token.service';
import { AppConfig } from '../config/app-config';

@Injectable()
export class RefreshTokenService {
  constructor(private readonly tokens: TokenService, private readonly config: AppConfig) {}

  /** Mint a new refresh token (raw + stored hash) and its absolute expiry. */
  issue(): { token: string; hash: string; expiresAt: Date } {
    const { token, hash } = this.tokens.newRefreshToken();
    const expiresAt = new Date(Date.now() + this.config.auth.refreshTtlSec * 1000);
    return { token, hash, expiresAt };
  }

  matches(presented: string, storedHash: string): boolean {
    return this.tokens.refreshMatches(presented, storedHash);
  }
}
