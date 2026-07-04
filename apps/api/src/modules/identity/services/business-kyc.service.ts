// modules/identity/services/business-kyc.service.ts · buyer business-KYC submit + status read + admin review.
// The RAW gstin/pan arrive ONCE on submit; this service shape-validates them, checks GSTIN↔PAN consistency, then
// stores ONLY the masked forms (DPDP §4 — the raw ids are never persisted or logged). Every write is one ACID tx
// (UoW) + an audit entry that records the MASKED values only. Review is admin (identity.approve), tenant-scoped.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { BadRequestError, NotFoundError } from '../../../shared/errors/app-error';
import { BusinessKycRepository, BusinessKycRow } from '../repositories/business-kyc.repository';
import { SubmitBusinessKycDto, ReviewBusinessKycDto } from '../dto/submit-business-kyc.dto';
import { isValidGstin, isValidPan, maskGstin, maskPan, gstinPanConsistent } from '../domain/business-kyc.rules';

@Injectable()
export class BusinessKycService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly audit: AuditWriter,
    private readonly repo: BusinessKycRepository,
  ) {}

  /** Submit (or re-submit) the caller's business-KYC profile. Idempotency is by (tenant,user) upsert, not a key. */
  async submit(tenantId: string, userId: string, dto: SubmitBusinessKycDto, ip: string | null) {
    if (!isValidPan(dto.pan)) throw new BadRequestError('PAN must look like ABCDE1234F');
    if (dto.gstin !== undefined && !isValidGstin(dto.gstin)) throw new BadRequestError('GSTIN must be a valid 15-character GSTIN');
    if (dto.gstin !== undefined && !gstinPanConsistent(dto.gstin, dto.pan)) throw new BadRequestError('GSTIN does not match the given PAN');
    const gstinMasked = dto.gstin !== undefined ? maskGstin(dto.gstin) : null;
    const panMasked = maskPan(dto.pan);

    const row = await this.uow.run(tenantId, async (tx) => {
      const saved = await this.repo.upsert(tx, {
        id: uuidv7(), tenantId, userId, businessType: dto.businessType, legalName: dto.legalName,
        gstinMasked, panMasked, docMediaIds: dto.docMediaIds,
      });
      // audit: MASKED values only — never the raw GSTIN/PAN.
      await this.audit.write(tx, { tenantId, actorUserId: userId, action: 'business_kyc.submitted', entityType: 'business_kyc_profile', entityId: saved.id, newValue: { businessType: saved.businessType, gstinMasked, panMasked, docCount: dto.docMediaIds.length }, ip });
      return saved;
    }, { userId });
    return this.serialize(row);
  }

  /** The caller's OWN business-KYC status (masked). Returns a `status:'none'` shell when nothing is submitted yet. */
  async status(tenantId: string, userId: string) {
    const row = await this.repo.getForUser(tenantId, userId);
    if (!row) return { status: 'none' as const, businessType: null, legalName: null, gstinMasked: null, panMasked: null, docMediaIds: [], rejectReason: null, reviewedAt: null, submittedAt: null };
    return this.serialize(row);
  }

  /** Admin review (verify | reject). Tenant-scoped (identity.approve), audited; reviewer sees masked values only. */
  async review(tenantId: string, reviewerId: string, id: string, dto: ReviewBusinessKycDto, ip: string | null) {
    return this.uow.run(tenantId, async (tx) => {
      const row = await this.repo.getForUpdate(tx, tenantId, id);
      if (!row) throw new NotFoundError('Business KYC profile not found');
      const status = dto.decision === 'verify' ? 'verified' : 'rejected';
      await this.repo.markReviewed(tx, tenantId, id, status, reviewerId, dto.decision === 'reject' ? (dto.reason ?? 'rejected') : null);
      await this.audit.write(tx, { tenantId, actorUserId: reviewerId, action: `business_kyc.${dto.decision}`, entityType: 'business_kyc_profile', entityId: id, oldValue: { status: row.status }, newValue: { status }, reason: dto.reason ?? null, ip });
      return { id, status };
    }, { userId: reviewerId });
  }

  private serialize(r: BusinessKycRow) {
    return {
      status: r.status, businessType: r.businessType, legalName: r.legalName,
      gstinMasked: r.gstinMasked, panMasked: r.panMasked, docMediaIds: r.docMediaIds,
      rejectReason: r.rejectReason, reviewedAt: r.reviewedAt, submittedAt: r.createdAt,
    };
  }
}
