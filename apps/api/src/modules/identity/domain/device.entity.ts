// modules/identity/domain/device.entity.ts · a user's known device (for session binding + push).
export interface DeviceProps {
  id: string; userId: string; fingerprint: string; platform: string | null; model: string | null;
  osVersion: string | null; appVersion: string | null; pushToken: string | null; lastSeenAt: Date;
}
export class Device {
  constructor(readonly props: DeviceProps) {}
  get id() { return this.props.id; }
}
