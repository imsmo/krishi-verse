// modules/catalogue/services/certificate.service.ts · submit a certificate (idempotent), and the moderator
// decision (verify/reject). One ACID tx per write; integration events to the outbox in the SAME tx (Law 4);
// audit row on the moderation decision; metrics per use-case. Reads on the replica. Tenant-scoped throughout
// (RLS + tenant_id in every query); a cert that isn't the caller's tenant's → 404 (no cross-tenant enumeration).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { Certificate } from '../domain/certificate.entity';
import { CertificateNotFoundError, InvalidCertificateError } from '../domain/catalogue.errors';
import { CertificateRepository } from '../repositories/certificate.repository';
import { CreateCertificateDto, DecideCertificateDto } from '../dto/create-certificate.dto';
import { QueryCertificateDto } from '../dto/query-certificate.dto';

const encodeCursor = (c: string, id: string) => Buffer.from(`${c}|${id}`).toString('base64');
const decodeCursor = (s?: string) => { if (!s) return undefined; const [c, id] = Buffer.from(s, 'base64').toString().split('|'); return c && id ? { c, id } : undefined; };

@Injectable()
export class CertificateService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: CertificateRepository,
  ) {}

  async submit(tenantId: string, actorUserId: string, idemKey: string, dto: CreateCertificateDto): Promise<{ id: string }> {
    return this.idem.remember(idemKey, actorUserId, 'catalogue.certificate.submit', () =>
      timed(this.metrics, 'catalogue.certificate.submit', { tenant: tenantId }, async () => {
        const id = uuidv7();
        const cert = Certificate.create({
          id, tenantId, ownerUserId: actorUserId, certTypeId: dto.certTypeId, certNo: dto.certNo ?? null,
          issuingBody: dto.issuingBody ?? null, subjectType: dto.subjectType, subjectId: dto.subjectId, mediaId: dto.mediaId ?? null,
          validFrom: dto.validFrom ?? null, validUntil: dto.validUntil ?? null, blockchainAnchor: null,
        });
        await this.uow.run(tenantId, async (tx) => {
          await this.repo.insert(tx, cert);
          await this.flush(tx, tenantId, id, cert.pullEvents());
        }, { userId: actorUserId });
        return { id };
      }));
  }

  async decide(tenantId: string, actorUserId: string, id: string, dto: DecideCertificateDto, ip: string | null): Promise<{ ok: true }> {
    await this.uow.run(tenantId, async (tx) => {
      const cert = await this.repo.getForUpdate(tx, tenantId, id);
      if (!cert) throw new CertificateNotFoundError(id);
      if (dto.decision === 'verify') {
        cert.verify(actorUserId, dto.validFrom ?? null, dto.validUntil ?? null);
      } else {
        if (!dto.reason || dto.reason.length < 3) throw new InvalidCertificateError('reason is required to reject');
        cert.reject(actorUserId, dto.reason);
      }
      await this.repo.update(tx, cert);
      await this.flush(tx, tenantId, id, cert.pullEvents());
      await this.audit.write(tx, { tenantId, actorUserId, action: `catalogue.certificate_${dto.decision === 'verify' ? 'verified' : 'rejected'}`, entityType: 'certificate', entityId: id, newValue: { status: cert.status }, reason: dto.reason ?? null, ip });
    }, { userId: actorUserId });
    return { ok: true };
  }

  /** Worker-only: flip a verified-but-lapsed cert to expired (idempotent — skips if no longer verified). */
  async expire(tenantId: string, id: string): Promise<void> {
    await this.uow.run(tenantId, async (tx) => {
      const cert = await this.repo.getForUpdate(tx, tenantId, id);
      if (!cert || cert.status !== 'verified') return;
      cert.expire();
      await this.repo.update(tx, cert);
      await this.flush(tx, tenantId, id, cert.pullEvents());
    }, { userId: 'system' });
  }

  list(tenantId: string, q: QueryCertificateDto) {
    return timed(this.metrics, 'catalogue.certificate.list', { tenant: tenantId }, async () => {
      const rows = await this.repo.list(tenantId, { subjectType: q.subjectType, subjectId: q.subjectId, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit });
      const items = rows.map((c) => c.toProps());
      const last = items[items.length - 1] as any;
      return { items, nextCursor: rows.length === q.limit && last ? encodeCursor(last.createdAt?.toISOString?.() ?? last.createdAt ?? '', last.id) : null };
    });
  }

  async getById(tenantId: string, id: string) {
    const c = await this.repo.getById(tenantId, id);
    if (!c) throw new CertificateNotFoundError(id);
    return c.toProps();
  }

  private async flush(tx: TxContext, tenantId: string, id: string, events: { type: string; payload: Record<string, unknown> }[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'certificate', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
