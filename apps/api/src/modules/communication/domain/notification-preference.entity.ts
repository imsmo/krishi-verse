// modules/communication/domain/notification-preference.entity.ts · a user's per event×channel opt-in/out.
// Keyed by (user_id, event_code, channel); user-scoped (no tenant_id). A preference may only DISABLE a
// channel for an opt-out-able event — enforced by the service against the catalog (CannotOptOutError).
import { NotifChannel } from './communication.events';

export interface NotificationPreferenceProps { userId: string; eventCode: string; channel: NotifChannel; isEnabled: boolean; }
export class NotificationPreference {
  private constructor(private readonly props: NotificationPreferenceProps) {}
  static rehydrate(p: NotificationPreferenceProps): NotificationPreference { return new NotificationPreference(p); }
  get eventCode() { return this.props.eventCode; }
  get channel() { return this.props.channel; }
  get isEnabled() { return this.props.isEnabled; }
  toJSON() { return { ...this.props }; }
}
