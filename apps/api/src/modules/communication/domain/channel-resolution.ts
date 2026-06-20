// modules/communication/domain/channel-resolution.ts · PURE channel-resolution policy (no I/O).
// Given a catalog event, the user's per-channel preferences, and their quiet hours, decide which channels to
// actually send on. Rules (PRD §14.3):
//   • start from the event's default_channels;
//   • a user may DISABLE a channel only if the event is opt-out-able (user_can_opt_out) — mandatory events
//     (OTP, dispute, payment) ignore preferences and always send;
//   • during quiet hours, INTRUSIVE channels (push/sms/whatsapp/ivr) are suppressed UNLESS the event is
//     'critical' (critical bypasses quiet hours); email + in-app are never quiet-hours-suppressed (passive);
//   • the result is deterministic and float-free.
import { NotifChannel, NotifPriority } from './communication.events';

export interface CatalogEvent { code: string; priority: NotifPriority; defaultChannels: NotifChannel[]; userCanOptOut: boolean; }
export interface QuietHours { starts: string; ends: string; timezone: string; }   // 'HH:MM[:SS]'
export type SuppressReason = 'opted_out' | 'quiet_hours';
export interface ChannelDecision { channels: NotifChannel[]; suppressed: { channel: NotifChannel; reason: SuppressReason }[]; }

const INTRUSIVE: ReadonlySet<NotifChannel> = new Set<NotifChannel>(['push', 'sms', 'whatsapp', 'ivr']);

/** Local wall-clock minutes-of-day in the user's timezone (stdlib Intl, DST-correct, no float). */
export function minutesOfDayInTz(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return (h % 24) * 60 + m;
}
function toMinutes(hhmm: string): number { const [h, m] = hhmm.split(':'); return (Number(h) % 24) * 60 + Number(m ?? '0'); }

/** Is `now` inside the (possibly overnight) quiet window? */
export function isWithinQuietHours(now: Date, q: QuietHours): boolean {
  const cur = minutesOfDayInTz(now, q.timezone);
  const start = toMinutes(q.starts), end = toMinutes(q.ends);
  if (start === end) return false;                 // zero-length window = disabled
  return start < end ? (cur >= start && cur < end) // same-day window
                     : (cur >= start || cur < end);// overnight window (e.g. 21:00→06:00)
}

export function resolveChannels(
  event: CatalogEvent,
  prefs: ReadonlyMap<NotifChannel, boolean>,        // explicit per-channel is_enabled overrides
  quiet: QuietHours | null,
  now: Date,
): ChannelDecision {
  const channels: NotifChannel[] = [];
  const suppressed: { channel: NotifChannel; reason: SuppressReason }[] = [];
  const inQuiet = quiet ? isWithinQuietHours(now, quiet) : false;
  for (const ch of event.defaultChannels) {
    if (event.userCanOptOut && prefs.get(ch) === false) { suppressed.push({ channel: ch, reason: 'opted_out' }); continue; }
    if (inQuiet && event.priority !== 'critical' && INTRUSIVE.has(ch)) { suppressed.push({ channel: ch, reason: 'quiet_hours' }); continue; }
    channels.push(ch);
  }
  return { channels, suppressed };
}
