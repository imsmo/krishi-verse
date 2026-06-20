// modules/communication/gateway/http-masking.gateway.ts · HTTP adapter to the masking telephony provider.
// Resilience-wrapped (timeout+retry+breaker+bulkhead) with a FALLBACK (degrade-not-die): if the telco is down,
// bridge() resolves to {ok:false} so the caller records nothing/handles gracefully — never throws. No PII logged.
import { Logger } from '@nestjs/common';
import { ResilienceService } from '../../../core/resilience/resilience.service';
import { MaskingProvider, BridgeInput, BridgeResult } from './masking-provider.port';

const DEP = 'masking-provider';

export interface HttpMaskingConfig { baseUrl: string; apiKey: string; }

export class HttpMaskingGateway implements MaskingProvider {
  readonly providerCode = 'http';
  private readonly log = new Logger('MaskingProvider');
  constructor(private readonly cfg: HttpMaskingConfig, private readonly resilience: ResilienceService) {}

  async bridge(input: BridgeInput): Promise<BridgeResult> {
    return this.resilience.run<BridgeResult>(DEP, async () => {
      const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, '')}/v1/calls/bridge`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': input.idempotencyKey, authorization: `Bearer ${this.cfg.apiKey}` },
        body: JSON.stringify({ caller_user_id: input.callerUserId, callee_user_id: input.calleeUserId, tenant_id: input.tenantId, context_type: input.contextType, context_id: input.contextId }),
      });
      const out = (await res.json().catch(() => ({}))) as any;
      if (res.status === 400 || res.status === 422) return { ok: false, failureReason: String(out?.error ?? 'rejected') };
      if (!res.ok) throw new Error(`masking provider responded ${res.status}`);
      return { ok: true, providerCallRef: out?.call_ref ?? out?.id };
    }, { fallback: () => { this.log.warn(`masking provider unavailable for ${input.contextType ?? 'direct'} call`); return { ok: false, failureReason: 'provider_unavailable' }; } });
  }
}
