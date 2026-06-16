// modules/identity/domain/session.entity.ts · an authenticated session bound to a refresh token.
// Only the HASH of the refresh token is ever held. Rotation replaces the hash + expiry.
export interface SessionProps {
  id: string; userId: string; deviceId: string | null; refreshTokenHash: string;
  ip: string | null; expiresAt: Date; revokedAt: Date | null; lastSeenAt: Date;
}
export class Session {
  private constructor(private props: SessionProps) {}
  static create(input: { id: string; userId: string; deviceId: string | null; refreshTokenHash: string; ip: string | null; expiresAt: Date }): Session {
    return new Session({ ...input, revokedAt: null, lastSeenAt: new Date() });
  }
  static rehydrate(p: SessionProps): Session { return new Session(p); }
  get id() { return this.props.id; }
  get userId() { return this.props.userId; }
  toProps(): Readonly<SessionProps> { return Object.freeze({ ...this.props }); }
  isValid(now: Date = new Date()): boolean { return !this.props.revokedAt && this.props.expiresAt > now; }
  rotate(newHash: string, newExpiry: Date): void { this.props.refreshTokenHash = newHash; this.props.expiresAt = newExpiry; this.props.lastSeenAt = new Date(); }
  revoke(now: Date = new Date()): void { this.props.revokedAt = now; }
}
