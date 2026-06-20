// modules/communication/gateway/http.gateway.ts
// HTTP/JSON adapter to the external notification product. Resilience-wrapped (timeout + retry + breaker +
// bulkhead) with a FALLBACK (degrade-not-die, Law 12): if the notifier is down, dispatch() resolves to
// {status:'failed'} so the delivery row is marked failed + retried by the dispatch job — it never throws into
// the relay/request path. NOT a money call, so retry + fallback are allowed. No PII/secret is logged.
import { Logger } from '@nestjs/common';
import { ResilienceService } from '../../../core/resilience/resilience.service';
import { NotificationGateway, DispatchInput, DispatchResult } from './notification-gateway.port';

const DEP = 'notification-gateway';

export interface HttpGatewayConfig { baseUrl: string; apiKey: string; }

export class HttpNotificationGateway implements NotificationGateway {
  readonly providerCode = 'http';
  private readonly log = new Logger('NotificationGateway');
  constructor(private readonly cfg: HttpGatewayConfig, private readonly resilience: ResilienceService) {}

  async dispatch(input: DispatchInput): Promise<DispatchResult> {
    return this.resilience.run<DispatchResult>(DEP, async () => {
      const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, '')}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': input.idempotencyKey,            // external product dedups on this
          authorization: `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify({
          channel: input.channel, user_id: input.userId, tenant_id: input.tenantId, event_code: input.eventCode,
          language_code: input.languageCode, subject: input.subject, body: input.body,
          template_ref: input.providerTemplateRef, data: input.payload,
        }),
      });
      const out = (await res.json().catch(() => ({}))) as any;
      if (res.status === 400 || res.status === 422) return { status: 'failed', failureReason: String(out?.error ?? 'rejected') };
      if (!res.ok) throw new Error(`notifier responded ${res.status}`);   // transient → retry, then fallback
      return { status: 'accepted', providerMsgRef: out?.id ?? out?.message_ref, costMinor: typeof out?.cost_minor === 'number' ? out.cost_minor : undefined };
    }, {
      // degrade, never die: an exhausted/broken notifier yields a failed outcome (job requeues), not a throw.
      fallback: () => { this.log.warn(`notifier unavailable; deferring ${input.channel} for event ${input.eventCode}`); return { status: 'failed', failureReason: 'notifier_unavailable' }; },
    });
  }
}
