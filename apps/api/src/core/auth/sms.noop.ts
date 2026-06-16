// core/auth/sms.noop.ts · default SmsSender (logs only). Phase 2 swaps in MSG91/Gupshup
// behind the same SMS_SENDER token. OTP codes must NEVER be logged in production.
import { Injectable, Logger } from '@nestjs/common';
import { SmsSender } from './otp.service';
import { AppConfig } from '../config/app-config';

@Injectable()
export class NoopSmsSender extends SmsSender {
  private readonly log = new Logger('SmsSender');
  constructor(private readonly config: AppConfig) { super(); }
  async send(phone: string, message: string): Promise<void> {
    if (this.config.isProd) this.log.warn(`SMS not configured; dropped message to ${phone}`);
    else this.log.debug(`[dev SMS] ${phone}: ${message}`);
  }
}
