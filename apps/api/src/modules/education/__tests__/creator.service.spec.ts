// modules/education/__tests__/creator.service.spec.ts · creator-content service unit tests with fakes.
// Pins: register needs channel.host; moderation needs content.moderate + writes an audit row; a host edits
// only their OWN channel (404 IDOR); live schedule requires the host's OWN APPROVED channel; live start
// degrades to 503 when the stream provider is down (nothing flips to live).
import { LearningChannelService } from '../services/learning-channel.service';
import { LiveSessionService } from '../services/live-session.service';
import { LearningChannel } from '../domain/learning-channel.entity';
import { ChannelNotFoundError, ChannelNotApprovedError, CreatorForbiddenError } from '../domain/creator.errors';
import { InfraError } from '../../../shared/errors/app-error';

const host = { userId: 'u1', canAuthor: false, canPublish: false, isAdmin: false, canHost: true, canModerate: false };
const mod = { userId: 'm1', canAuthor: false, canPublish: false, isAdmin: false, canHost: false, canModerate: true };
const approvedChannel = (owner = 'u1') => LearningChannel.rehydrate({ id: 'c1', tenantId: 't1', ownerUserId: owner, provider: 'youtube', title: 'T', handle: null, externalUrl: 'https://y/@x', topicId: null, description: null, status: 'approved', reviewNote: null, reviewedBy: null, reviewedAt: null });

function channelHarness(opts: { channel?: LearningChannel | null } = {}) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const audit = { write: jest.fn() };
  const repo = { insert: jest.fn(), getForUpdate: jest.fn(async () => opts.channel ?? null), getById: jest.fn(async () => opts.channel ?? null), update: jest.fn(), listFor: jest.fn() };
  const svc = new LearningChannelService(uow as any, outbox as any, metrics as any, audit as any, repo as any);
  return { svc, audit, repo };
}

describe('LearningChannelService', () => {
  it('register requires channel.host', async () => {
    const { svc } = channelHarness();
    await expect(svc.register('t1', { ...host, canHost: false }, { provider: 'youtube', title: 'X', externalUrl: 'https://y/@x' } as any)).rejects.toBeInstanceOf(CreatorForbiddenError);
  });
  it('moderation requires content.moderate and writes an audit row', async () => {
    const pending = LearningChannel.register({ id: 'c1', tenantId: 't1', ownerUserId: 'u1', provider: 'youtube', title: 'T', handle: null, externalUrl: 'https://y/@x', topicId: null, description: null });
    const { svc, audit } = channelHarness({ channel: pending });
    await expect(svc.moderate('t1', host, 'c1', 'approve', null, null)).rejects.toBeInstanceOf(CreatorForbiddenError);
    const { svc: svc2, audit: audit2 } = channelHarness({ channel: pending });
    await svc2.moderate('t1', mod, 'c1', 'approve', null, '1.1.1.1');
    expect(audit2.write).toHaveBeenCalledTimes(1);
    expect((audit2.write.mock.calls as any[])[0][1].action).toBe('education.channel_approve');
  });
  it('a host can edit only their OWN channel (404, no IDOR)', async () => {
    const { svc } = channelHarness({ channel: approvedChannel('someone-else') });
    await expect(svc.update('t1', host, 'c1', { title: 'hijack' } as any)).rejects.toBeInstanceOf(ChannelNotFoundError);
  });
});

function liveHarness(opts: { channel?: LearningChannel | null; streamOk?: boolean; session?: any } = {}) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const stream = { providerCode: 'fake', createStream: jest.fn(async () => (opts.streamOk === false ? { ok: false, failureReason: 'down' } : { ok: true, providerStreamRef: 'st1', playbackUrl: 'https://p/1' })) };
  const repo = { insert: jest.fn(), getForUpdate: jest.fn(async () => opts.session ?? null), getById: jest.fn(async () => opts.session ?? null), update: jest.fn(), register: jest.fn(), listFor: jest.fn() };
  const channels = { getById: jest.fn(async () => (opts.channel === undefined ? approvedChannel() : opts.channel)) };
  const svc = new LiveSessionService(uow as any, outbox as any, metrics as any, stream as any, repo as any, channels as any);
  return { svc, stream, repo };
}

describe('LiveSessionService', () => {
  it('schedule requires the host OWN an APPROVED channel', async () => {
    const draft = LearningChannel.rehydrate({ ...approvedChannel().toProps(), status: 'pending' } as any);
    const { svc } = liveHarness({ channel: draft });
    await expect(svc.schedule('t1', host, { channelId: 'c1', title: 'Q', scheduledAt: new Date().toISOString() } as any)).rejects.toBeInstanceOf(ChannelNotApprovedError);
  });
  it("schedule 404s when the channel isn't the host's", async () => {
    const { svc } = liveHarness({ channel: approvedChannel('other') });
    await expect(svc.schedule('t1', host, { channelId: 'c1', title: 'Q', scheduledAt: new Date().toISOString() } as any)).rejects.toBeInstanceOf(ChannelNotFoundError);
  });
  it('start degrades to 503 when the stream provider is down (nothing flips live)', async () => {
    const { LiveSession } = await import('../domain/live-session.entity');
    const session = LiveSession.schedule({ id: 's1', tenantId: 't1', hostUserId: 'u1', channelId: 'c1', title: 'Q', topicId: null, scheduledAt: new Date() });
    const { svc, repo } = liveHarness({ streamOk: false, session });
    await expect(svc.start('t1', host, 's1')).rejects.toBeInstanceOf(InfraError);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
