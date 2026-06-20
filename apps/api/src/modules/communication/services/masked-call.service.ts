// modules/communication/services/masked-call.service.ts · privacy-proxy calling (PRD §9.13).
// initiate: bridge the two users via the EXTERNAL masking provider (resilience-wrapped, OUTSIDE the tx — no
// network in a DB transaction), then record the log row (user ids + provider ref ONLY; never raw phones).
// Idempotent per (user, endpoint). A provider failure degrades to a typed 503 (caller retries) — nothing is
// recorded. complete() is driven by the provider's call-status webhook (idempotent). Reads are own-log only.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { InfraError } from '../../../shared/errors/app-error';
import { uuidv7 } from '../../../core/database/uuid.util';
import { MASKING_PROVIDER, MaskingProvider } from '../gateway/masking-provider.port';
import { MaskedCall } from '../domain/masked-call.entity';
import { DomainEvent, ContextType } from '../domain/messaging.events';
import { MaskedCallRepository } from '../repositories/masked-call.repository';
import { InitiateMaskedCallDto } from '../dto/initiate-masked-call.dto';
import { MessagingActor } from './conversation.service';

@Injectable()
export class MaskedCallService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    @Inject(MASKING_PROVIDER) private readonly provider: MaskingProvider,
    private readonly repo: MaskedCallRepository,
  ) {}

  async initiate(tenantId: string, actor: MessagingActor, idemKey: string, dto: InitiateMaskedCallDto) {
    return this.idem.remember(idemKey, actor.userId, 'comm.maskedcall.initiate', () =>
      timed(this.metrics, 'comm.maskedcall.initiate', { tenant: tenantId }, async () => {
        const id = uuidv7();
        const bridged = await this.provider.bridge({ idempotencyKey: id, tenantId, callerUserId: actor.userId, calleeUserId: dto.calleeUserId, contextType: dto.contextType ?? null, contextId: dto.contextId ?? null });
        if (!bridged.ok || !bridged.providerCallRef) { this.metrics.inc('comm.maskedcall.failed', { reason: bridged.failureReason ?? 'unknown' }); throw new InfraError('MASKED_CALL_UNAVAILABLE', 'Could not place the call right now', { reason: bridged.failureReason }); }
        return this.uow.run(tenantId, async (tx) => {
          const call = MaskedCall.initiate({ id, tenantId, callerUserId: actor.userId, calleeUserId: dto.calleeUserId, contextType: (dto.contextType ?? null) as ContextType | null, contextId: dto.contextId ?? null, providerCallRef: bridged.providerCallRef! });
          await this.repo.insert(tx, call);
          await this.flush(tx, tenantId, id, call.pullEvents());
          return call.toJSON();
        }, { userId: actor.userId });
      }));
  }

  /** Provider call-status webhook → set duration (idempotent). null tenant ⇒ relay-wide lookup by ref. */
  async applyCallStatus(tenantId: string | null, providerCallRef: string, durationSecs: number, recordingMediaId: string | null): Promise<boolean> {
    return this.uow.run(tenantId ?? '', async (tx) => {
      const call = await this.repo.getByProviderRef(tx, providerCallRef);
      if (!call) return false;
      call.complete(durationSecs, recordingMediaId);
      await this.repo.update(tx, call);
      await this.flush(tx, call.toProps().tenantId, call.id, call.pullEvents());
      return true;
    });
  }

  async list(tenantId: string, actor: MessagingActor, q: { cursor?: { c: string; id: string }; limit: number }) {
    const rows = await this.repo.listForUser(tenantId, actor.userId, q);
    const items = rows.map((c) => c.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  private async flush(tx: TxContext, tenantId: string | null, id: string, evts: DomainEvent[]): Promise<void> {
    for (const e of evts) await this.outbox.write(tx, { tenantId, aggregateType: 'masked_call', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
