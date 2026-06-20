// modules/education/services/learning-channel.service.ts · register + moderate external content channels.
// register needs channel.host (→ 'pending'); approve/suspend/reject need content.moderate (the host-authority
// gate) and write an audit row IN THE SAME tx. One ACID tx per write, outbox in-tx (Law 4), authz THROWS.
// A host may edit only their OWN channel (404, not 403, on a non-owner — no IDOR).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { LearningChannel } from '../domain/learning-channel.entity';
import { DomainEvent, ChannelProvider } from '../domain/creator.events';
import { LearningChannelRepository } from '../repositories/learning-channel.repository';
import { RegisterChannelDto, UpdateChannelDto } from '../dto/register-channel.dto';
import { ChannelNotFoundError, CreatorForbiddenError } from '../domain/creator.errors';
import { EducationActor } from './instructor.service';

@Injectable()
export class LearningChannelService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: LearningChannelRepository,
  ) {}

  async register(tenantId: string, actor: EducationActor, dto: RegisterChannelDto) {
    if (!actor.canHost) throw new CreatorForbiddenError('requires channel.host');
    return timed(this.metrics, 'education.channel.register', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const c = LearningChannel.register({ id: uuidv7(), tenantId, ownerUserId: actor.userId, provider: dto.provider as ChannelProvider, title: dto.title,
          handle: dto.handle ?? null, externalUrl: dto.externalUrl, topicId: dto.topicId ?? null, description: dto.description ?? null });
        await this.repo.insert(tx, c);
        await this.flush(tx, tenantId, c.id, c.pullEvents());
        return c.toJSON();
      }, { userId: actor.userId }));
  }
  async update(tenantId: string, actor: EducationActor, id: string, dto: UpdateChannelDto) {
    return this.uow.run(tenantId, async (tx) => {
      const c = await this.repo.getForUpdate(tx, tenantId, id);
      if (!c || c.ownerUserId !== actor.userId) throw new ChannelNotFoundError(id);   // 404, no IDOR
      c.update(dto);
      await this.repo.update(tx, c);
      return c.toJSON();
    }, { userId: actor.userId });
  }
  async moderate(tenantId: string, actor: EducationActor, id: string, action: 'approve' | 'suspend' | 'reject', note: string | null, ip: string | null) {
    if (!actor.canModerate) throw new CreatorForbiddenError('requires content.moderate');
    return this.uow.run(tenantId, async (tx) => {
      const c = await this.repo.getForUpdate(tx, tenantId, id);
      if (!c) throw new ChannelNotFoundError(id);
      if (action === 'approve') c.approve(actor.userId); else if (action === 'suspend') c.suspend(actor.userId, note); else c.reject(actor.userId, note);
      await this.repo.update(tx, c);
      await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: `education.channel_${action}`, entityType: 'learning_channel', entityId: id, newValue: { status: c.status }, reason: note, ip });
      await this.flush(tx, tenantId, id, c.pullEvents());
      return c.toJSON();
    }, { userId: actor.userId });
  }
  async getById(tenantId: string, actor: EducationActor, id: string) {
    const c = await this.repo.getById(tenantId, id);
    if (!c) throw new ChannelNotFoundError(id);
    // an unapproved channel is visible only to its owner or a moderator
    if (c.status !== 'approved' && c.ownerUserId !== actor.userId && !actor.canModerate) throw new ChannelNotFoundError(id);
    return c.toJSON();
  }
  async list(tenantId: string, actor: EducationActor, q: { box: 'browse' | 'mine' | 'all'; status?: string; topicId?: string; cursor?: { c: string; id: string }; limit: number }) {
    if (q.box === 'all' && !actor.canModerate) throw new CreatorForbiddenError('requires content.moderate');
    const rows = await this.repo.listFor(tenantId, { box: q.box, ownerUserId: q.box === 'mine' ? actor.userId : undefined, status: q.status, topicId: q.topicId, cursor: q.cursor, limit: q.limit });
    return this.page(rows.map((c) => c.toJSON()), q.limit);
  }
  private page(items: any[], limit: number) {
    const last = items[items.length - 1];
    const nextCursor = items.length === limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  private async flush(tx: TxContext, tenantId: string, id: string, evts: DomainEvent[]): Promise<void> {
    for (const e of evts) await this.outbox.write(tx, { tenantId, aggregateType: 'learning_channel', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
