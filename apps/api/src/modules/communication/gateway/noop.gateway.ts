// modules/communication/gateway/noop.gateway.ts · default gateway when no external notifier is configured.
// Mirrors core/auth/sms.noop: in prod it warns + drops (returns 'failed' so nothing is silently lost); in
// dev/test it accepts so flows can be exercised without a live notifier. NEVER logs body/PII.
import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../../core/config/app-config';
import { NotificationGateway, DispatchInput, DispatchResult } from './notification-gateway.port';

@Injectable()
export class NoopNotificationGateway implements NotificationGateway {
  readonly providerCode = 'noop';
  private readonly log = new Logger('NotificationGateway');
  constructor(private readonly config: AppConfig) {}
  async dispatch(input: DispatchInput): Promise<DispatchResult> {
    if (this.config.isProd) { this.log.warn(`notifier not configured; dropped ${input.channel} for event ${input.eventCode}`); return { status: 'failed', failureReason: 'notifier_not_configured' }; }
    this.log.debug(`[dev notify] ${input.channel} → user ${input.userId} (${input.eventCode})`);
    return { status: 'accepted', providerMsgRef: `dev-${input.idempotencyKey}` };
  }
}
