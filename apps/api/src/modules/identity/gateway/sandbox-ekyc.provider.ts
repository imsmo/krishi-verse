// modules/identity/gateway/sandbox-ekyc.provider.ts
// Deterministic dev/test eKYC provider. Bound ONLY when EKYC_PROVIDER_KIND='sandbox' AND not production
// (the config factory + assertProductionSecurity forbid it in prod — the dev path must NEVER ship). It accepts a
// fixed test OTP so local/integration flows exercise the full start→verify path WITHOUT a live provider, and it
// returns a synthetic vaultRef derived from a hash of the id (never the raw id). It still NEVER logs the raw id.
import { createHash } from 'node:crypto';
import { EkycProvider, EkycStartInput, EkycStartResult, EkycVerifyInput, EkycVerifyResult } from './ekyc-provider.port';
import { maskId } from '../domain/id-masking';

/** The only OTP the sandbox accepts. Real providers send a real OTP out-of-band; the sandbox never sends anything. */
export const SANDBOX_EKYC_OTP = '123456';

export class SandboxEkycProvider implements EkycProvider {
  readonly providerCode = 'sandbox';

  async start(input: EkycStartInput): Promise<EkycStartResult> {
    // a stable provider ref bound to the id hash (not the id) so verify is deterministic in tests
    const providerRef = `sbx_${createHash('sha256').update(`${input.docType}|${input.idNumber}`).digest('hex').slice(0, 24)}`;
    return { providerRef, otpRequired: true };
  }

  async verify(input: EkycVerifyInput): Promise<EkycVerifyResult> {
    if (input.otp !== SANDBOX_EKYC_OTP) return { verified: false, failureReason: 'incorrect_otp' };
    // the vault ref is a deterministic token over the providerRef — opaque, contains no raw id
    const vaultRef = `vault_${createHash('sha256').update(input.providerRef).digest('hex').slice(0, 32)}`;
    return { verified: true, vaultRef, nameMatch: true, validUntil: null };
  }
}

// re-export so the service can mask without importing the helper twice
export { maskId };
