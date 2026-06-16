// modules/identity/domain/user.entity.ts
// Aggregate root for a HUMAN identity (global, tenant-independent; keyed by phone).
// Pure domain — no I/O. Security/PII rules enforced here:
//  • raw Aadhaar/PAN/bank NEVER live on this entity — only last4 + external vault refs;
//  • status transitions go through the state machine (Law 5);
//  • toPublic() masks PII so a leak of the view object can't expose identifiers.
import { UserStatus, assertUserTransition, isLoginable } from './user.state';
import { InvalidPhoneError, UnderageError } from './identity.errors';
import { isValidE164, maskPhone } from '../../../shared/utils/phone';

export type DomainEvent = { type: string; payload: Record<string, unknown> };

export interface UserProps {
  id: string;
  phone: string;                 // E.164
  phoneVerifiedAt: Date | null;
  fullName: string | null;
  gender: string | null;
  dob: string | null;            // ISO date
  languageCode: string;
  countryCode: string;
  email: string | null;
  emailVerifiedAt: Date | null;
  photoMediaId: string | null;
  status: UserStatus;
  aadhaarLast4: string | null;
  aadhaarVaultRef: string | null;
  panVaultRef: string | null;
  isTest: boolean;
  lastActiveAt: Date | null;
}

export class User {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: UserProps) {}

  static register(input: { id: string; phone: string; fullName?: string | null; languageCode?: string; countryCode?: string; isTest?: boolean }): User {
    if (!isValidE164(input.phone)) throw new InvalidPhoneError();
    const u = new User({
      id: input.id, phone: input.phone, phoneVerifiedAt: new Date(),
      fullName: input.fullName ?? null, gender: null, dob: null,
      languageCode: input.languageCode ?? 'hi', countryCode: input.countryCode ?? 'IN',
      email: null, emailVerifiedAt: null, photoMediaId: null,
      status: 'active', aadhaarLast4: null, aadhaarVaultRef: null, panVaultRef: null,
      isTest: input.isTest ?? false, lastActiveAt: new Date(),
    });
    u.events.push({ type: 'identity.user_registered', payload: { userId: u.props.id } });
    return u;
  }

  static rehydrate(props: UserProps): User { return new User(props); }

  get id() { return this.props.id; }
  get phone() { return this.props.phone; }
  get status() { return this.props.status; }
  get isLoginable() { return isLoginable(this.props.status); }
  toProps(): Readonly<UserProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  /** Masked, safe-to-serialise view (no vault refs, masked phone/email). */
  toPublic() {
    const p = this.props;
    return {
      id: p.id, phone: maskPhone(p.phone), phoneVerified: !!p.phoneVerifiedAt,
      fullName: p.fullName, languageCode: p.languageCode, countryCode: p.countryCode,
      email: p.email ? p.email.replace(/(^.).*(@.*$)/, '$1***$2') : null,
      status: p.status, hasAadhaar: !!p.aadhaarVaultRef, hasPan: !!p.panVaultRef,
      lastActiveAt: p.lastActiveAt,
    };
  }

  changeStatus(to: UserStatus, by?: string): void {
    assertUserTransition(this.props.status, to);
    if (this.props.status === to) return;
    const from = this.props.status;
    this.props.status = to;
    this.events.push({ type: 'identity.user_status_changed', payload: { userId: this.props.id, from, to, by } });
  }

  updateProfile(input: Partial<Pick<UserProps, 'fullName' | 'gender' | 'dob' | 'languageCode' | 'email' | 'photoMediaId'>>): void {
    if (input.fullName !== undefined) this.props.fullName = input.fullName;
    if (input.gender !== undefined) this.props.gender = input.gender;
    if (input.dob !== undefined) this.props.dob = input.dob;
    if (input.languageCode !== undefined) this.props.languageCode = input.languageCode;
    if (input.email !== undefined) { this.props.email = input.email; this.props.emailVerifiedAt = null; }
    if (input.photoMediaId !== undefined) this.props.photoMediaId = input.photoMediaId;
  }

  /** Store ONLY tokens/last4 from an external KYC vault (never raw identifiers). */
  setAadhaarVault(last4: string, vaultRef: string): void { this.props.aadhaarLast4 = last4; this.props.aadhaarVaultRef = vaultRef; }
  setPanVault(vaultRef: string): void { this.props.panVaultRef = vaultRef; }
  touchActive(now: Date = new Date()): void { this.props.lastActiveAt = now; }

  ageYears(asOf: Date = new Date()): number | null {
    if (!this.props.dob) return null;
    const dob = new Date(this.props.dob);
    let a = asOf.getUTCFullYear() - dob.getUTCFullYear();
    const m = asOf.getUTCMonth() - dob.getUTCMonth();
    if (m < 0 || (m === 0 && asOf.getUTCDate() < dob.getUTCDate())) a--;
    return a;
  }
  /** Enforce a minimum age (e.g. 18 for worker/regulated roles). */
  assertMinAge(minAge: number): void {
    const a = this.ageYears();
    if (a !== null && a < minAge) throw new UnderageError(minAge);
  }
}
