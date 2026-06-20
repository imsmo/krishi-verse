// modules/communication/__tests__/communication-domain.spec.ts · pure-domain invariants (no I/O).
// Pins: template {{var}} render (missing keys blank, nested path, never leaks the token); the notif.state
// machine; and channel resolution — opt-out only for opt-out-able events, quiet hours suppress intrusive
// channels for non-critical events while critical bypasses, email/inapp never quiet-suppressed.
import { NotificationTemplate } from '../domain/notification-template.entity';
import { resolveChannels, isWithinQuietHours } from '../domain/channel-resolution';
import { assertTransition, canTransition } from '../domain/notification.state';
import { IllegalNotificationTransitionError } from '../domain/communication.errors';
import { NotifChannel } from '../domain/communication.events';

const tmpl = (body: string, subject: string | null = null) => NotificationTemplate.rehydrate({ id: 't1', eventCode: 'order.delivered', channel: 'push', languageCode: 'en', tenantId: null, subject, body, providerTemplateRef: null, isActive: true });

describe('NotificationTemplate.render', () => {
  it('interpolates {{vars}}, supports nested paths, blanks missing keys (never leaks the token)', () => {
    const r = tmpl('Order {{orderNo}} → {{addr.city}}; ref {{missing}}').render({ orderNo: 'A1', addr: { city: 'Pune' } });
    expect(r.body).toBe('Order A1 → Pune; ref ');
    expect(r.body).not.toMatch(/\{\{/);
  });
  it('renders subject too', () => { expect(tmpl('b', 'Hi {{name}}').render({ name: 'Dev' }).subject).toBe('Hi Dev'); });
});

describe('notif.state machine', () => {
  it('queued→sent→delivered→read legal; read terminal', () => {
    expect(canTransition('queued', 'sent')).toBe(true);
    expect(canTransition('sent', 'delivered')).toBe(true);
    expect(canTransition('delivered', 'read')).toBe(true);
    expect(() => assertTransition('read', 'sent')).toThrow(IllegalNotificationTransitionError);
  });
  it('queued can be suppressed or failed; failed can requeue', () => {
    expect(canTransition('queued', 'suppressed')).toBe(true);
    expect(canTransition('failed', 'queued')).toBe(true);
    expect(canTransition('queued', 'delivered')).toBe(false);
  });
});

describe('channel resolution', () => {
  const event = (over: Partial<any> = {}) => ({ code: 'order.delivered', priority: 'important' as const, defaultChannels: ['push', 'sms', 'inapp'] as NotifChannel[], userCanOptOut: true, ...over });
  const noQuiet = null; const now = new Date('2026-06-20T12:00:00Z');   // midday IST → not quiet

  it('sends all default channels when no prefs/quiet apply', () => {
    const d = resolveChannels(event(), new Map(), noQuiet, now);
    expect(d.channels.sort()).toEqual(['inapp', 'push', 'sms']);
  });
  it('honors an opt-out for an opt-out-able event', () => {
    const d = resolveChannels(event(), new Map<NotifChannel, boolean>([['sms', false]]), noQuiet, now);
    expect(d.channels).not.toContain('sms');
    expect(d.suppressed).toContainEqual({ channel: 'sms', reason: 'opted_out' });
  });
  it('IGNORES opt-out for a mandatory event (cannot disable)', () => {
    const d = resolveChannels(event({ userCanOptOut: false }), new Map<NotifChannel, boolean>([['sms', false]]), noQuiet, now);
    expect(d.channels).toContain('sms');
  });
  it('quiet hours suppress intrusive channels for non-critical, but never inapp; critical bypasses', () => {
    const quiet = { starts: '21:00', ends: '06:00', timezone: 'Asia/Kolkata' };
    const night = new Date('2026-06-20T18:30:00Z');   // 00:00 IST → within quiet
    const nonCrit = resolveChannels(event(), new Map(), quiet, night);
    expect(nonCrit.channels).toEqual(['inapp']);                 // push+sms suppressed, inapp kept
    expect(nonCrit.suppressed.map((s) => s.channel).sort()).toEqual(['push', 'sms']);
    const crit = resolveChannels(event({ priority: 'critical' }), new Map(), quiet, night);
    expect(crit.channels.sort()).toEqual(['inapp', 'push', 'sms']); // critical ignores quiet hours
  });
});

describe('isWithinQuietHours (overnight + DST-correct via Intl)', () => {
  const q = { starts: '21:00', ends: '06:00', timezone: 'Asia/Kolkata' };
  it('true at 00:00 IST, false at 12:00 IST', () => {
    expect(isWithinQuietHours(new Date('2026-06-20T18:30:00Z'), q)).toBe(true);   // 00:00 IST
    expect(isWithinQuietHours(new Date('2026-06-20T06:30:00Z'), q)).toBe(false);  // 12:00 IST
  });
});
