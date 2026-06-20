// modules/education/services/live-session.service.ts · schedule + run live streaming sessions.
// schedule needs channel.host AND the host's OWN APPROVED channel (the host-authority gate). start calls the
// external stream provider (resilience-wrapped, OUTSIDE the tx — no network in a DB tx) then flips live; a
// provider outage degrades to a typed 503 (nothing flips). end/cancel are host-only. register is any learner.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { InfraError } from '../../../shared/errors/app-error';
import { uuidv7 } from '../../../core/database/uuid.util';
import { STREAM_PROVIDER, StreamProvider } from '../gateway/stream-provider.port';
import { LiveSession } from '../domain/live-session.entity';
import { DomainEvent } from '../domain/creator.events';
import { isPublishable } from '../domain/channel.state';
import { LiveSessionRepository } from '../repositories/live-session.repository';
import { LearningChannelRepository } from '../repositories/learning-channel.repository';
import { ScheduleLiveDto } from '../dto/schedule-live.dto';
import { LiveSessionNotFoundError, ChannelNotFoundError, ChannelNotApprovedError, CreatorForbiddenError } from '../domain/creator.errors';
import { EducationActor } from './instructor.service';

@Injectable()
export class LiveSessionService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(METRICS) private readonly metrics: Metrics,
    @Inject(STREAM_PROVIDER) private readonly stream: StreamProvider,
    private readonly repo: LiveSessionRepository,
    private readonly channels: LearningChannelRepository,
  ) {}

  async schedule(tenantId: string, actor: EducationActor, dto: ScheduleLiveDto) {
    if (!actor.canHost) throw new CreatorForbiddenError('requires channel.host');
    return timed(this.metrics, 'education.live.schedule', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const channel = await this.channels.getById(tenantId, dto.channelId, tx);
        if (!channel || channel.ownerUserId !== actor.userId) throw new ChannelNotFoundError(dto.channelId);   // 404, no IDOR
        if (!isPublishable(channel.status)) throw new ChannelNotApprovedError(channel.status);
        const s = LiveSession.schedule({ id: uuidv7(), tenantId, hostUserId: actor.userId, channelId: channel.id, title: dto.title, topicId: dto.topicId ?? null, scheduledAt: new Date(dto.scheduledAt) });
        await this.repo.insert(tx, s);
        await this.flush(tx, tenantId, s.id, s.pullEvents());
        return s.toJSON();
      }, { userId: actor.userId }));
  }

  /** Go live: provision the stream OUTSIDE the tx, then flip to 'live' in-tx. Degrades to 503 if provider down. */
  async start(tenantId: string, actor: EducationActor, id: string) {
    const existing = await this.repo.getById(tenantId, id);
    if (!existing || existing.hostUserId !== actor.userId) throw new LiveSessionNotFoundError(id);
    const provisioned = await this.stream.createStream({ idempotencyKey: id, tenantId, sessionId: id, hostUserId: actor.userId, title: existing.toJSON().title as string });
    if (!provisioned.ok || !provisioned.providerStreamRef) { this.metrics.inc('education.live.provision_failed', { reason: provisioned.failureReason ?? 'unknown' }); throw new InfraError('LIVE_PROVIDER_UNAVAILABLE', 'Could not start the live stream right now', { reason: provisioned.failureReason }); }
    return this.uow.run(tenantId, async (tx) => {
      const s = await this.repo.getForUpdate(tx, tenantId, id);
      if (!s || s.hostUserId !== actor.userId) throw new LiveSessionNotFoundError(id);
      s.start(provisioned.providerStreamRef!, provisioned.playbackUrl ?? null);
      await this.repo.update(tx, s);
      await this.flush(tx, tenantId, id, s.pullEvents());
      return s.toJSON();
    }, { userId: actor.userId });
  }
  async end(tenantId: string, actor: EducationActor, id: string, recordingMediaId: string | null) {
    return this.hostMutate(tenantId, actor, id, (s) => s.end(recordingMediaId));
  }
  async cancel(tenantId: string, actor: EducationActor, id: string) {
    return this.hostMutate(tenantId, actor, id, (s) => s.cancel());
  }
  async register(tenantId: string, actor: EducationActor, id: string) {
    return this.uow.run(tenantId, async (tx) => {
      const s = await this.repo.getForUpdate(tx, tenantId, id);
      if (!s) throw new LiveSessionNotFoundError(id);
      await this.repo.register(tx, id, actor.userId);
      return { ok: true };
    }, { userId: actor.userId });
  }
  async getById(tenantId: string, id: string) {
    const s = await this.repo.getById(tenantId, id);
    if (!s) throw new LiveSessionNotFoundError(id);
    return s.toJSON();
  }
  async list(tenantId: string, actor: EducationActor, q: { box: 'upcoming' | 'mine' | 'all'; cursor?: { c: string; id: string }; limit: number }) {
    const rows = await this.repo.listFor(tenantId, { box: q.box, hostUserId: q.box === 'mine' ? actor.userId : undefined, cursor: q.cursor, limit: q.limit });
    const items = rows.map((s) => s.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }
  private async hostMutate(tenantId: string, actor: EducationActor, id: string, fn: (s: LiveSession) => void) {
    return this.uow.run(tenantId, async (tx) => {
      const s = await this.repo.getForUpdate(tx, tenantId, id);
      if (!s || s.hostUserId !== actor.userId) throw new LiveSessionNotFoundError(id);
      fn(s);
      await this.repo.update(tx, s);
      await this.flush(tx, tenantId, id, s.pullEvents());
      return s.toJSON();
    }, { userId: actor.userId });
  }
  private async flush(tx: TxContext, tenantId: string, id: string, evts: DomainEvent[]): Promise<void> {
    for (const e of evts) await this.outbox.write(tx, { tenantId, aggregateType: 'live_session', aggregateId: id, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
