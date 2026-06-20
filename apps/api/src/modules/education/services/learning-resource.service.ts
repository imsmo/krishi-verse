// modules/education/services/learning-resource.service.ts · publish + moderate curated resources.
// publish needs channel.host. Under the host's OWN APPROVED channel a resource auto-approves (trust already
// established); standalone (or under someone else's/unapproved channel) it is 'pending' until a moderator
// approves. takedown/approve need content.moderate (+ audit). authz THROWS; reads are status/owner-gated.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { LearningResource } from '../domain/learning-resource.entity';
import { DomainEvent, ResourceKind } from '../domain/creator.events';
import { LearningResourceRepository } from '../repositories/learning-resource.repository';
import { LearningChannelRepository } from '../repositories/learning-channel.repository';
import { CreateResourceDto } from '../dto/create-resource.dto';
import { ResourceNotFoundError, CreatorForbiddenError } from '../domain/creator.errors';
import { EducationActor } from './instructor.service';

@Injectable()
export class LearningResourceService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly repo: LearningResourceRepository,
    private readonly channels: LearningChannelRepository,
  ) {}

  async publish(tenantId: string, actor: EducationActor, dto: CreateResourceDto) {
    if (!actor.canHost) throw new CreatorForbiddenError('requires channel.host');
    return timed(this.metrics, 'education.resource.publish', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        let autoApprove = false;
        if (dto.channelId) {
          const channel = await this.channels.getById(tenantId, dto.channelId, tx);
          if (!channel) throw new CreatorForbiddenError('unknown channel');
          // auto-approve only when posting under YOUR OWN approved channel (trust established); else moderation
          autoApprove = channel.ownerUserId === actor.userId && channel.status === 'approved';
        }
        const r = LearningResource.create({ id: uuidv7(), tenantId, channelId: dto.channelId ?? null, ownerUserId: actor.userId, kind: dto.kind as ResourceKind,
          title: dto.title, externalUrl: dto.externalUrl ?? null, mediaId: dto.mediaId ?? null, topicId: dto.topicId ?? null, languageCode: dto.languageCode ?? null, body: dto.body ?? null, autoApprove });
        await this.repo.insert(tx, r);
        await this.flush(tx, tenantId, r.id, r.pullEvents());
        return r.toJSON();
      }, { userId: actor.userId }));
  }
  async moderate(tenantId: string, actor: EducationActor, id: string, action: 'approve' | 'takedown', note: string | null, ip: string | null) {
    if (!actor.canModerate) throw new CreatorForbiddenError('requires content.moderate');
    return this.uow.run(tenantId, async (tx) => {
      const r = await this.repo.getForUpdate(tx, tenantId, id);
      if (!r) throw new ResourceNotFoundError(id);
      if (action === 'approve') r.approve(actor.userId); else r.takedown(actor.userId, note);
      await this.repo.update(tx, r);
      await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: `education.resource_${action}`, entityType: 'learning_resource', entityId: id, newValue: { status: r.status }, reason: note, ip });
      await this.flush(tx, tenantId, id, r.pullEvents());
      return r.toJSON();
    }, { userId: actor.userId });
  }
  async list(tenantId: string, actor: EducationActor, q: { box: 'browse' | 'mine' | 'all'; channelId?: string; kind?: string; topicId?: string; status?: string; cursor?: { c: string; id: string }; limit: number }) {
    if (q.box === 'all' && !actor.canModerate) throw new CreatorForbiddenError('requires content.moderate');
    const rows = await this.repo.listFor(tenantId, { box: q.box, ownerUserId: q.box === 'mine' ? actor.userId : undefined, channelId: q.channelId, kind: q.kind, topicId: q.topicId, status: q.status, cursor: q.cursor, limit: q.limit });
    const items = rows.map((r) => r.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  private async flush(tx: TxContext, tenantId: string, id: string, evts: DomainEvent[]): Promise<void> {
    for (const e of evts) await this.outbox.write(tx, { tenantId, aggregateType: 'learning_resource', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
