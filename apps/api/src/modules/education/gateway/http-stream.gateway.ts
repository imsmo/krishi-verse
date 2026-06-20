// modules/education/gateway/http-stream.gateway.ts · HTTP adapter to the live-streaming provider.
// Resilience-wrapped (timeout+retry+breaker+bulkhead) with a FALLBACK (degrade-not-die): if the streamer is
// down, createStream resolves to {ok:false} so the caller surfaces a typed 503 — never throws into the relay.
import { Logger } from '@nestjs/common';
import { ResilienceService } from '../../../core/resilience/resilience.service';
import { StreamProvider, CreateStreamInput, CreateStreamResult } from './stream-provider.port';

const DEP = 'stream-provider';
export interface HttpStreamConfig { baseUrl: string; apiKey: string; }

export class HttpStreamGateway implements StreamProvider {
  readonly providerCode = 'http';
  private readonly log = new Logger('StreamProvider');
  constructor(private readonly cfg: HttpStreamConfig, private readonly resilience: ResilienceService) {}

  async createStream(input: CreateStreamInput): Promise<CreateStreamResult> {
    return this.resilience.run<CreateStreamResult>(DEP, async () => {
      const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, '')}/v1/live-streams`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': input.idempotencyKey, authorization: `Bearer ${this.cfg.apiKey}` },
        body: JSON.stringify({ session_id: input.sessionId, host_user_id: input.hostUserId, tenant_id: input.tenantId, title: input.title }),
      });
      const out = (await res.json().catch(() => ({}))) as any;
      if (res.status === 400 || res.status === 422) return { ok: false, failureReason: String(out?.error ?? 'rejected') };
      if (!res.ok) throw new Error(`stream provider responded ${res.status}`);
      return { ok: true, providerStreamRef: out?.id ?? out?.stream_ref, playbackUrl: out?.playback_url ?? null };
    }, { fallback: () => { this.log.warn(`stream provider unavailable for session ${input.sessionId}`); return { ok: false, failureReason: 'provider_unavailable' }; } });
  }
}
