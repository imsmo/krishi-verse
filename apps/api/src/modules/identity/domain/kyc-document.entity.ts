// modules/identity/domain/kyc-document.entity.ts
// A submitted KYC document + its verification lifecycle (state machine). Only a
// MASKED document number is stored here; the verified identifier lives in an
// external vault (referenced from the user). Expiry is tracked for renewals.
import { KycStatus, assertKycTransition } from './kyc-document.state';
import type { DomainEvent } from './user.entity';

export interface KycDocumentProps {
  id: string;
  tenantId: string | null;
  userId: string;
  roleId: string | null;
  docTypeId: string;
  mediaId: string | null;   // null for eKYC (provider attestation, no uploaded image); required for manual submit
  docNoMasked: string | null;
  issuedBy: string | null;
  validFrom: string | null;
  validUntil: string | null;
  status: KycStatus;
  verifyMethod: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectReason: string | null;
}

export class KycDocument {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: KycDocumentProps) {}

  static submit(input: { id: string; tenantId: string | null; userId: string; roleId?: string | null; docTypeId: string; mediaId?: string | null; docNoMasked?: string | null; issuedBy?: string | null; validFrom?: string | null; validUntil?: string | null; verifyMethod?: string }): KycDocument {
    const d = new KycDocument({
      id: input.id, tenantId: input.tenantId, userId: input.userId, roleId: input.roleId ?? null,
      docTypeId: input.docTypeId, mediaId: input.mediaId ?? null, docNoMasked: input.docNoMasked ?? null,
      issuedBy: input.issuedBy ?? null, validFrom: input.validFrom ?? null, validUntil: input.validUntil ?? null,
      status: 'pending', verifyMethod: input.verifyMethod ?? 'manual', reviewedBy: null, reviewedAt: null, rejectReason: null,
    });
    d.events.push({ type: 'identity.kyc_submitted', payload: { kycId: d.props.id, userId: d.props.userId, tenantId: d.props.tenantId } });
    return d;
  }
  static rehydrate(props: KycDocumentProps): KycDocument { return new KycDocument(props); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  get userId() { return this.props.userId; }
  toProps(): Readonly<KycDocumentProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  verify(reviewerId: string, now: Date = new Date()): void {
    assertKycTransition(this.props.status, 'verified');
    this.props.status = 'verified'; this.props.reviewedBy = reviewerId; this.props.reviewedAt = now; this.props.rejectReason = null;
    this.events.push({ type: 'identity.kyc_verified', payload: { kycId: this.props.id, userId: this.props.userId, tenantId: this.props.tenantId } });
  }
  reject(reviewerId: string, reason: string, now: Date = new Date()): void {
    assertKycTransition(this.props.status, 'rejected');
    this.props.status = 'rejected'; this.props.reviewedBy = reviewerId; this.props.reviewedAt = now; this.props.rejectReason = reason;
    this.events.push({ type: 'identity.kyc_rejected', payload: { kycId: this.props.id, userId: this.props.userId, reason } });
  }
  expire(): void { assertKycTransition(this.props.status, 'expired'); this.props.status = 'expired'; }
}
