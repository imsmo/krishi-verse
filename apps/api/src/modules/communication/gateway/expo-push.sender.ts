// modules/communication/gateway/expo-push.sender.ts
// Expo Push API adapter (https://exp.host/--/api/v2/push/send). Resilience-wrapped (timeout + retry + breaker +
// bulkhead) with a FALLBACK (degrade-not-die, Law 12): if Expo is down the send resolves to {sent:0} so the
// delivery row is marked failed + retried — it NEVER throws into the relay/request path. Tokens are batched
// (Expo caps a request at 100). Per-ticket 'DeviceNotRegistered' errors are surfaced as invalidTokens so the
// spine can deactivate dead tokens (token hygiene). The access token (if configured) authenticates + raises
// rate limits; it is sent as a Bearer header and never logged. Not a money call → retry + fallback are allowed.
import { Logger } from '@nestjs/common';
import { ResilienceService } from '../../../core/resilience/resilience.service';
import { PushSender, PushMessage, PushSendResult } from './push-sender.port';

const DEP = 'expo-push';
const BATCH = 100;
const chunk = <T>(xs: T[], n: number): T[][] => { const out: T[][] = []; for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n)); return out; };

export interface ExpoPushConfig { baseUrl: string; accessToken: string | null; }

export class ExpoPushSender implements PushSender {
  readonly providerCode = 'expo';
  private readonly log = new Logger('PushSender');
  constructor(private readonly cfg: ExpoPushConfig, private readonly resilience: ResilienceService) {}

  async send(msg: PushMessage): Promise<PushSendResult> {
    const tokens = msg.tokens.filter(Boolean);
    if (tokens.length === 0) return { sent: 0, invalidTokens: [], failureReason: 'no_tokens' };
    let sent = 0; const invalidTokens: string[] = [];
    for (const batch of chunk(tokens, BATCH)) {
      const res = await this.sendBatch(batch, msg);
      sent += res.sent; invalidTokens.push(...res.invalidTokens);
    }
    return { sent, invalidTokens, failureReason: sent === 0 ? 'push_unavailable' : undefined };
  }

  private sendBatch(tokens: string[], msg: PushMessage): Promise<{ sent: number; invalidTokens: string[] }> {
    const messages = tokens.map((to) => ({ to, title: msg.title ?? undefined, body: msg.body, data: msg.data ?? {}, priority: 'high' as const }));
    return this.resilience.run<{ sent: number; invalidTokens: string[] }>(DEP, async () => {
      const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
      if (this.cfg.accessToken) headers.authorization = `Bearer ${this.cfg.accessToken}`;
      const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, '')}/--/api/v2/push/send`, {
        method: 'POST', headers, body: JSON.stringify(messages),
      });
      if (!res.ok) throw new Error(`expo push responded ${res.status}`);   // transient → retry, then fallback
      const out = (await res.json().catch(() => ({}))) as { data?: Array<{ status?: string; details?: { error?: string } }> };
      const tickets = Array.isArray(out.data) ? out.data : [];
      const invalidTokens: string[] = [];
      let sent = 0;
      tickets.forEach((t, i) => {
        if (t?.status === 'ok') sent += 1;
        else if (t?.details?.error === 'DeviceNotRegistered' && tokens[i]) invalidTokens.push(tokens[i]);
      });
      // a malformed/empty body but 2xx: treat the whole batch as accepted (Expo took it)
      if (tickets.length === 0) sent = tokens.length;
      return { sent, invalidTokens };
    }, {
      fallback: () => { this.log.warn(`expo push unavailable; deferring ${tokens.length} message(s)`); return { sent: 0, invalidTokens: [] }; },
    });
  }
}
