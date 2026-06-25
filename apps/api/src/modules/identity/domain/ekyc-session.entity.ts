// modules/identity/domain/ekyc-session.entity.ts
// The aggregate that binds an external eKYC provider transaction to a (tenant,user) so OTP verify is anti-IDOR.
// It NEVER holds the raw Aadhaar/PAN — only the provider ref, a masked id + last-4, the attempt count and state.
import { EkycSessionStatus, EKYC_MAX_ATTEMPTS, assertEkycTransition } from './ekyc-session.state';
import { EkycTooManyAttemptsError } from './identity.errors';
import type { DomainEvent } from './user.entity';

export type EkycDoc = 'aadhaar' | 'pan';

export interface EkycSessionProps {
  id: string;
  tenantId: string;
  userId: string;
  docType: EkycDoc;
  providerCode: string;
  providerRef: string;
  maskedId: string;
  last4: string;
  nameMatch: boolean | null;
  otpRequired: boolean;
  attempts: number;
  status: EkycSessionStatus;
  failureReason: string | null;
  validUntil: string | null;
  expiresAt: Date;
  verifiedAt: Date | null;
  version: number;
}

/** Default session validity window (start → must verify within). */
export const EKYC_SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class EkycSession {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: EkycSessionProps) {}

  static start(input: {
    id: string; tenantId: string; userId: string; docType: EkycDoc; providerCode: string;
    providerRef: string; maskedId: string; last4: string; otpRequired: boolean; now?: Date;
  }): EkycSession {
    const now = input.now ?? new Date();
    const s = new EkycSession({
      id: input.id, tenantId: input.tenantId, userId: input.userId, docType: input.docType,
      providerCode: input.providerCode, providerRef: input.providerRef, maskedId: input.maskedId, last4: input.last4,
      nameMatch: null, otpRequired: input.otpRequired, attempts: 0, status: 'pending', failureReason: null,
      validUntil: null, expiresAt: new Date(now.getTime() + EKYC_SESSION_TTL_MS), verifiedAt: null, version: 0,
    });
    s.events.push({ type: 'identity.ekyc_started', payload: { sessionId: s.props.id, userId: s.props.userId, tenantId: s.props.tenantId, docType: s.props.docType } });
    return s;
  }
  static rehydrate(props: EkycSessionProps): EkycSession { return new EkycSession(props); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  get userId() { return this.props.userId; }
  get providerRef() { return this.props.providerRef; }
  get docType() { return this.props.docType; }
  get version() { return this.props.version; }
  toProps(): Readonly<EkycSessionProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  isExpired(now: Date = new Date()): boolean { return this.props.status === 'pending' && now >= this.props.expiresAt; }

  /** A successful provider verify. Stamps the name-match + validity and emits the verified event. */
  markVerified(input: { nameMatch?: boolean | null; validUntil?: string | null; now?: Date }): void {
    assertEkycTransition(this.props.status, 'verified');
    const now = input.now ?? new Date();
    this.props.status = 'verified';
    this.props.nameMatch = input.nameMatch ?? null;
    this.props.validUntil = input.validUntil ?? null;
    this.props.verifiedAt = now;
    this.props.failureReason = null;
    this.events.push({ type: 'identity.ekyc_verified', payload: { sessionId: this.props.id, userId: this.props.userId, tenantId: this.props.tenantId, docType: this.props.docType } });
  }

  /** A failed provider verify (wrong/expired OTP). Counts the attempt; locks → 'failed' at the cap. */
  recordFailure(reason: string): void {
    this.props.attempts += 1;
    this.props.failureReason = reason;
    if (this.props.attempts >= EKYC_MAX_ATTEMPTS) {
      assertEkycTransition(this.props.status, 'failed');
      this.props.status = 'failed';
      this.events.push({ type: 'identity.ekyc_failed', payload: { sessionId: this.props.id, userId: this.props.userId, tenantId: this.props.tenantId, reason: 'attempts_exceeded' } });
    }
  }

  /** True once no more attempts are allowed (locked). */
  isLocked(): boolean { return this.props.attempts >= EKYC_MAX_ATTEMPTS || this.props.status !== 'pending'; }
  assertCanAttempt(): void { if (this.isLocked()) throw new EkycTooManyAttemptsError(); }

  expire(): void { assertEkycTransition(this.props.status, 'expired'); this.props.status = 'expired'; this.props.failureReason = 'expired'; }
}
