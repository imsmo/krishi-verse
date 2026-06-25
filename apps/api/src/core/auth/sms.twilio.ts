// core/auth/sms.twilio.ts · Twilio SMS adapter (global fallback / non-India). Free-text is allowed outside the
// DLT regime, so the default sendOtp (delegates to send with the pre-rendered localized message) is correct here.
// Resilience-wrapped; an OTP send failure THROWS (no silent fallback). The message (which contains the code) is
// NEVER logged.
import { Logger } from '@nestjs/common';
import { ResilienceService } from '../resilience/resilience.service';
import { SmsSender } from './otp.service';

const DEP = 'sms';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  from: string; // a Twilio number or Messaging Service SID (MG...)
}

export class TwilioSmsSender extends SmsSender {
  private readonly log = new Logger('SmsSender');
  constructor(private readonly cfg: TwilioConfig, private readonly resilience: ResilienceService) { super(); }

  async send(phone: string, message: string): Promise<void> {
    await this.resilience.run<void>(DEP, async () => {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.cfg.accountSid}/Messages.json`;
      const body = new URLSearchParams({ To: phone, Body: message });
      // Messaging Service SID (MG...) goes in MessagingServiceSid; a plain number goes in From.
      if (this.cfg.from.startsWith('MG')) body.set('MessagingServiceSid', this.cfg.from);
      else body.set('From', this.cfg.from);
      const auth = Buffer.from(`${this.cfg.accountSid}:${this.cfg.authToken}`).toString('base64');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${auth}` },
        body: body.toString(),
      });
      if (!res.ok) {
        const out = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(`twilio sms send failed (${res.status}): ${out?.message ?? 'unknown'}`);
      }
    }, { retries: 1 });
    this.log.debug('sms dispatched via twilio'); // no phone, no body
  }
}
