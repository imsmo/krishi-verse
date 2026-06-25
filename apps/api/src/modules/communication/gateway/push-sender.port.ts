// modules/communication/gateway/push-sender.port.ts
// FIRST-PARTY push transport. The generic NotificationGateway delegates token resolution to an external
// notifier product; for the PUSH channel we instead own delivery end-to-end: the notification spine resolves
// the recipient's registered device tokens (push_devices, P0-10) and hands them to this sender. Adapters are
// resilience-wrapped and DEGRADE (never throw into the relay tx, Law 12). The token is sensitive — never logged.
export const PUSH_SENDER = Symbol('PUSH_SENDER');

export interface PushMessage {
  idempotencyKey: string;                 // = the notification id (so a retry can be deduped upstream)
  tokens: string[];                       // the recipient's active device tokens (≥1; sender batches)
  title: string | null;
  body: string;
  data?: Record<string, unknown>;         // deep-link / ids for the client to route on tap
}

export interface PushSendResult {
  /** how many messages the provider ACCEPTED (a ticket was issued). 0 = nothing delivered (degraded/failed). */
  sent: number;
  /** tokens the provider reported as permanently dead (e.g. Expo 'DeviceNotRegistered') — caller deactivates them. */
  invalidTokens: string[];
  failureReason?: string;
}

export interface PushSender {
  readonly providerCode: string;
  send(msg: PushMessage): Promise<PushSendResult>;
}
