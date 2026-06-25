// core/auth/sms.msg91.ts · MSG91 SMS adapter (Indian DLT gateway). The OTP path uses MSG91's OTP API with a
// DLT-APPROVED template, passing OUR self-generated code (`otp` param) — so the code stays hashed-at-rest +
// single-use on our side while the SMS is DLT-compliant. Resilience-wrapped (timeout+retry+breaker); an OTP send
// failure THROWS (no silent fallback — the user must be able to retry, not believe a code was sent). The OTP code
// is NEVER logged.
import { Logger } from '@nestjs/common';
import { ResilienceService } from '../resilience/resilience.service';
import { SmsSender, SmsOtpContext } from './otp.service';

const DEP = 'sms';

export interface Msg91Config {
  authKey: string;
  senderId: string;
  otpTemplateId: string;
  baseUrl: string;
}

/** MSG91 wants the mobile as countrycode+number with NO leading '+': "+919812345678" -> "919812345678". */
export function toMsg91Mobile(phoneE164: string): string {
  return phoneE164.replace(/[^\d]/g, '');
}

export class Msg91SmsSender extends SmsSender {
  private readonly log = new Logger('SmsSender');
  constructor(private readonly cfg: Msg91Config, private readonly resilience: ResilienceService) { super(); }

  /** Generic free-text SMS is not DLT-permissible — OTP is the only SMS path. Fail loudly if misused. */
  async send(phone: string, _message: string): Promise<void> {
    throw new Error('Msg91SmsSender: raw-text SMS is not DLT-permitted; use sendOtp (templated)');
  }

  async sendOtp(phone: string, ctx: SmsOtpContext, _renderedMessage: string): Promise<void> {
    const mobile = toMsg91Mobile(phone);
    await this.resilience.run<void>(DEP, async () => {
      const url = `${this.cfg.baseUrl.replace(/\/$/, '')}/api/v5/otp`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authkey: this.cfg.authKey },
        body: JSON.stringify({
          template_id: this.cfg.otpTemplateId,
          sender: this.cfg.senderId,
          mobile,
          otp: ctx.code,                       // our code; the DLT template renders it
          otp_expiry: String(ctx.ttlMin),
        }),
      });
      const out = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
      // MSG91 returns 200 with {type:'success'|'error'}. Treat non-success as a failure (retryable by breaker).
      if (!res.ok || out?.type === 'error') {
        // never include the code; `out.message` is provider status text, not PII
        throw new Error(`msg91 otp send failed (${res.status}): ${out?.message ?? 'unknown'}`);
      }
    }, { retries: 1 }); // idempotent enough (provider de-dupes per mobile window); no fallback → throws on failure
    this.log.debug(`otp dispatched via msg91 (${ctx.purpose})`); // no phone, no code
  }
}
