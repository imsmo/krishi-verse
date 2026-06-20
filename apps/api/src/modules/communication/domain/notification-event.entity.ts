// modules/communication/domain/notification-event.entity.ts · a row of the GLOBAL trigger catalog
// (notification_events, no tenant_id — platform reference data, read-only in this module, Law 11).
import { NotifChannel, NotifPriority } from './communication.events';

export interface NotificationEventProps {
  code: string; defaultName: string; priority: NotifPriority; defaultChannels: NotifChannel[]; userCanOptOut: boolean; batchable: boolean;
}
export class NotificationEvent {
  private constructor(private readonly props: NotificationEventProps) {}
  static rehydrate(p: NotificationEventProps): NotificationEvent { return new NotificationEvent(p); }
  get code() { return this.props.code; }
  get priority() { return this.props.priority; }
  get defaultChannels() { return this.props.defaultChannels; }
  get userCanOptOut() { return this.props.userCanOptOut; }
  get batchable() { return this.props.batchable; }
  /** The shape channel-resolution consumes. */
  toCatalog() { return { code: this.props.code, priority: this.props.priority, defaultChannels: this.props.defaultChannels, userCanOptOut: this.props.userCanOptOut }; }
  toJSON() { return { ...this.props }; }
}
