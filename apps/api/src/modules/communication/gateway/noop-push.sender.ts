// modules/communication/gateway/noop-push.sender.ts
// Dev/degrade push sender: bound when PUSH_PROVIDER is explicitly 'none' (or in local dev without Expo). It
// NEVER reaches a real device — it just accepts the message so the delivery row records 'sent' locally. In
// production this is a warning (a real provider should be configured); it never leaks the token.
import { Logger } from '@nestjs/common';
import { PushSender, PushMessage, PushSendResult } from './push-sender.port';

export class NoopPushSender implements PushSender {
  readonly providerCode = 'noop';
  private readonly log = new Logger('PushSender');
  constructor(private readonly isProd: boolean) {}

  async send(msg: PushMessage): Promise<PushSendResult> {
    if (this.isProd) this.log.warn(`PUSH dropped (no provider configured) for ${msg.tokens.length} device(s)`);
    return { sent: msg.tokens.length, invalidTokens: [] };
  }
}
