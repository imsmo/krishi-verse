// modules/communication/__tests__/notification.service.spec.ts · NotificationService unit tests with fakes.
// Pins: fanout records ONE row per resolved channel; 'inapp' is recorded without an external send; an unknown
// catalog event is skipped (fail-closed, no spam); a gateway failure DEGRADES to a 'failed' row (never throws
// into the relay); opt-out suppresses a channel; mark-read 404s for a non-owner (no IDOR).
import { NotificationService } from '../services/notification.service';
import { NotificationEvent } from '../domain/notification-event.entity';
import { NotificationTemplate } from '../domain/notification-template.entity';
import { NotificationPreference } from '../domain/notification-preference.entity';
import { NotificationNotFoundError } from '../domain/communication.errors';
import { NotifChannel } from '../domain/communication.events';

const catalog = (over: Partial<any> = {}) => NotificationEvent.rehydrate({ code: 'order.delivered', defaultName: 'Delivered', priority: 'important', defaultChannels: ['push', 'inapp'] as NotifChannel[], userCanOptOut: true, batchable: false, ...over });
const template = (channel: NotifChannel) => NotificationTemplate.rehydrate({ id: `tmpl-${channel}`, eventCode: 'order.delivered', channel, languageCode: 'en', tenantId: null, subject: null, body: 'Order {{orderNo}} delivered', providerTemplateRef: null, isActive: true });

function harness(opts: { event?: NotificationEvent | null; prefs?: NotificationPreference[]; gatewayStatus?: 'accepted' | 'failed' } = {}) {
  const inserted: any[] = [];
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const gateway = { providerCode: 'fake', dispatch: jest.fn(async () => ({ status: opts.gatewayStatus ?? 'accepted', providerMsgRef: 'pmr-1', costMinor: 12 })) };
  const events = { getByCode: jest.fn(async () => (opts.event === undefined ? catalog() : opts.event)) };
  const templates = { resolve: jest.fn(async (_t: any, _e: string, channel: NotifChannel) => template(channel)) };
  const prefs = { listForUser: jest.fn(async () => opts.prefs ?? []) };
  const quiet = { getForUser: jest.fn(async () => null) };
  const notifications = { insert: jest.fn(async (_tx: any, n: any) => { inserted.push(n); }), getForUserUpdate: jest.fn(async () => null), update: jest.fn(), getByProviderRef: jest.fn() };
  const svc = new NotificationService(uow as any, outbox as any, metrics as any, gateway as any, events as any, templates as any, prefs as any, quiet as any, notifications as any);
  return { svc, tx, gateway, notifications, inserted, metrics };
}

describe('NotificationService.fanout', () => {
  it('records one row per resolved channel; dispatches non-inapp, skips the gateway for inapp', async () => {
    const h = harness();
    await h.svc.fanout(h.tx as any, { tenantId: 't1', eventCode: 'order.delivered', recipients: ['u1'], payload: { orderNo: 'A1' }, dedupeKey: 'evt-1' });
    expect(h.inserted).toHaveLength(2);                              // push + inapp
    expect(h.gateway.dispatch).toHaveBeenCalledTimes(1);            // only push went to the gateway
    const channels = h.inserted.map((n) => n.toProps().channel).sort();
    expect(channels).toEqual(['inapp', 'push']);
    expect(h.inserted.every((n) => n.status === 'sent')).toBe(true);
  });
  it('skips an uncatalogued event (fail-closed — no spam)', async () => {
    const h = harness({ event: null });
    await h.svc.fanout(h.tx as any, { tenantId: 't1', eventCode: 'nope', recipients: ['u1'], payload: {}, dedupeKey: 'e' });
    expect(h.inserted).toHaveLength(0);
    expect(h.gateway.dispatch).not.toHaveBeenCalled();
  });
  it('DEGRADES on gateway failure: the push row is recorded failed, no throw', async () => {
    const h = harness({ gatewayStatus: 'failed' });
    await h.svc.fanout(h.tx as any, { tenantId: 't1', eventCode: 'order.delivered', recipients: ['u1'], payload: {}, dedupeKey: 'evt-2' });
    const push = h.inserted.find((n) => n.toProps().channel === 'push');
    expect(push.status).toBe('failed');
    const inapp = h.inserted.find((n) => n.toProps().channel === 'inapp');
    expect(inapp.status).toBe('sent');                              // inapp unaffected
  });
  it('honors an opt-out: a disabled channel is not recorded', async () => {
    const h = harness({ prefs: [NotificationPreference.rehydrate({ userId: 'u1', eventCode: 'order.delivered', channel: 'push', isEnabled: false })] });
    await h.svc.fanout(h.tx as any, { tenantId: 't1', eventCode: 'order.delivered', recipients: ['u1'], payload: {}, dedupeKey: 'evt-3' });
    expect(h.inserted.map((n) => n.toProps().channel)).toEqual(['inapp']);
  });
  it('derives a STABLE notification id (idempotent re-delivery → same id → gateway dedup)', async () => {
    const a = harness(); await a.svc.fanout(a.tx as any, { tenantId: 't1', eventCode: 'order.delivered', recipients: ['u1'], payload: {}, dedupeKey: 'evt-X' });
    const b = harness(); await b.svc.fanout(b.tx as any, { tenantId: 't1', eventCode: 'order.delivered', recipients: ['u1'], payload: {}, dedupeKey: 'evt-X' });
    const idsA = a.inserted.map((n) => n.id).sort();
    const idsB = b.inserted.map((n) => n.id).sort();
    expect(idsA).toEqual(idsB);
    expect((a.gateway.dispatch.mock.calls as any[])[0][0].idempotencyKey).toBe(a.inserted.find((n) => n.toProps().channel === 'push').id);
  });
});

describe('NotificationService.markRead', () => {
  it('404s for a non-owner / missing notification (no cross-user IDOR)', async () => {
    const h = harness();
    await expect(h.svc.markRead('t1', 'u1', 'n-does-not-exist')).rejects.toBeInstanceOf(NotificationNotFoundError);
  });
});
