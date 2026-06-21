// apps/stream-processor/src/downstream/notifier.client.ts · HTTP client to the SAME external notification product
// the communication module uses (POST /v1/messages with an idempotency-key the product dedups on). The
// notification-fanout consumer calls this. A 4xx (bad request) is permanent → DLQ; 5xx/network → throw
// (transient) → retry. When NOTIFIER_URL is unset the client is disabled (degrade: in-app inbox + the api's own
// dispatch job still deliver; the stream path is an accelerator, not the only route). No PII/secret is logged.
import { PoisonMessageError } from '../processing/retry-policy';

export interface NotifyRequest {
  idempotencyKey: string;
  tenantId: string | null;
  userId: string;
  channel: string;
  eventCode: string;
  payload: Record<string, unknown>;
}

export class NotifierClient {
  constructor(private readonly baseUrl: string | null, private readonly apiKey: string | null, private readonly timeoutMs = 4000) {}
  get enabled(): boolean { return this.baseUrl !== null; }

  async dispatch(req: NotifyRequest): Promise<void> {
    if (!this.baseUrl) return;                               // disabled → no-op (degrade)
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl.replace(/\/+$/, '')}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': req.idempotencyKey,
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({ channel: req.channel, user_id: req.userId, tenant_id: req.tenantId, event_code: req.eventCode, data: req.payload }),
        signal: ctrl.signal,
      });
      if (res.ok) return;
      if (res.status === 400 || res.status === 422) throw new PoisonMessageError('NOTIFIER_REJECTED', `notifier ${res.status}`);
      throw new Error(`notifier ${res.status}`);             // transient
    } finally {
      clearTimeout(timer);
    }
  }
}
