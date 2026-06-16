// modules/identity/services/consent.service.ts · DPDP consent capture (append-only).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { Consent } from '../domain/consent.entity';
import { ConsentRepository } from '../repositories/consent.repository';
import { GrantConsentDto } from '../dto/grant-consent.dto';

@Injectable()
export class ConsentService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    private readonly repo: ConsentRepository,
  ) {}
  async grant(tenantId: string, userId: string, dto: GrantConsentDto) {
    const version = (await this.repo.currentVersion(tenantId, dto.purposeCode)) ?? 'v1';
    await this.uow.run(tenantId, async (tx) => {
      const c = Consent.record({ id: uuidv7(), userId, purposeCode: dto.purposeCode, version, granted: dto.granted, channel: dto.channel, assistedBy: dto.assistedBy ?? null });
      await this.repo.record(tx, c);
      await this.outbox.write(tx, { tenantId, aggregateType: 'user', aggregateId: userId, eventType: 'identity.consent_changed', payload: { v: 1, userId, purposeCode: dto.purposeCode, granted: dto.granted, version } });
    }, { userId });
    return { ok: true, version };
  }
  list(tenantId: string, userId: string) { return this.repo.latestByUser(tenantId, userId); }
}
