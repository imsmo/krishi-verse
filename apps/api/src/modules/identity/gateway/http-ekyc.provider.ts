// modules/identity/gateway/http-ekyc.provider.ts
// Real HTTP adapter to an external eKYC provider (UIDAI Aadhaar-OTP aggregator / DigiLocker / Karza). The RAW id
// is sent ONLY in the start() request body to the provider over TLS; it is NEVER logged and NEVER returned. The
// provider replies with an opaque vaultRef + masked id; we persist only those. Resilience-wrapped (timeout +
// retry + breaker + bulkhead) — but NOT idempotent-retried on verify (an OTP submit must not be auto-replayed),
// and on exhaustion it throws EkycProviderError (degrade, never hang — Law 12). Bearer-authed; signature of the
// provider response is not a webhook here (synchronous), so we trust the TLS channel + api key.
import { Logger } from '@nestjs/common';
import { ResilienceService } from '../../../core/resilience/resilience.service';
import { EkycProvider, EkycStartInput, EkycStartResult, EkycVerifyInput, EkycVerifyResult } from './ekyc-provider.port';
import { EkycProviderError } from '../domain/identity.errors';

const DEP = 'ekyc-provider';

export interface HttpEkycConfig { baseUrl: string; apiKey: string; }

export class HttpEkycProvider implements EkycProvider {
  readonly providerCode = 'http';
  private readonly log = new Logger('EkycProvider');
  constructor(private readonly cfg: HttpEkycConfig, private readonly resilience: ResilienceService) {}

  async start(input: EkycStartInput): Promise<EkycStartResult> {
    return this.resilience.run<EkycStartResult>(DEP, async () => {
      const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, '')}/v1/ekyc/initiate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.cfg.apiKey}` },
        // the RAW id leaves the process ONLY here, over TLS, to the provider. Not logged.
        body: JSON.stringify({ doc_type: input.docType, id_number: input.idNumber, name: input.fullName ?? undefined }),
      });
      if (!res.ok) throw new Error(`ekyc initiate responded ${res.status}`);   // transient → retry, then fallback throws
      const out = (await res.json().catch(() => ({}))) as { reference_id?: string; otp_required?: boolean };
      if (!out.reference_id) throw new Error('ekyc initiate missing reference_id');
      return { providerRef: out.reference_id, otpRequired: out.otp_required !== false };
    }, {
      // retries OK (no side effect created yet); exhaustion → typed 503 (never hangs the request)
      fallback: () => { this.log.warn(`ekyc provider unavailable on initiate (${input.docType})`); throw new EkycProviderError(); },
    });
  }

  async verify(input: EkycVerifyInput): Promise<EkycVerifyResult> {
    return this.resilience.run<EkycVerifyResult>(DEP, async () => {
      const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, '')}/v1/ekyc/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.cfg.apiKey}` },
        body: JSON.stringify({ reference_id: input.providerRef, otp: input.otp }),
      });
      if (res.status === 400 || res.status === 401 || res.status === 422) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        return { verified: false, failureReason: String(e?.error ?? 'verification_failed') };   // definitive: don't retry
      }
      if (!res.ok) throw new Error(`ekyc verify responded ${res.status}`);   // transient → retry
      const out = (await res.json().catch(() => ({}))) as { verified?: boolean; vault_ref?: string; masked_id?: string; name_match?: boolean; valid_until?: string };
      if (!out.verified || !out.vault_ref) return { verified: false, failureReason: 'not_verified' };
      return { verified: true, vaultRef: out.vault_ref, maskedId: out.masked_id, nameMatch: out.name_match, validUntil: out.valid_until ?? null };
    }, {
      // NO auto-retry side effects: verify() is a single OTP attempt. On transport exhaustion → 503 (caller retries
      // explicitly). We DON'T mark the session failed here (it wasn't a wrong OTP, just an outage).
      retries: 0,
      fallback: () => { this.log.warn('ekyc provider unavailable on verify'); throw new EkycProviderError(); },
    });
  }
}
