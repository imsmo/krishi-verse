// modules/communication/domain/push-device.entity.ts · a user's registered push device (Expo/FCM token).
// Pure domain: validates the registration (platform ∈ the supported set, token non-empty + bounded) and
// normalises the token (trim) so the unique-on-token upsert is stable. No I/O. The token is sensitive —
// the entity never exposes it in events/logs; only the repository persists it.
import { InvalidPushDeviceError } from './communication.errors';

export const PUSH_PLATFORMS = ['ios', 'android', 'web'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

export interface PushDeviceProps { userId: string; platform: PushPlatform; token: string; }

export class PushDevice {
  private constructor(readonly props: PushDeviceProps) {}

  /** Validate + normalise a (re)registration. Throws on a bad platform or empty/oversized token. */
  static register(input: { userId: string; platform: string; token: string }): PushDevice {
    const token = (input.token ?? '').trim();
    if (!token) throw new InvalidPushDeviceError('Push token is required');
    if (token.length > 512) throw new InvalidPushDeviceError('Push token is too long');
    if (!PUSH_PLATFORMS.includes(input.platform as PushPlatform)) throw new InvalidPushDeviceError(`Unsupported platform '${input.platform}'`);
    if (!input.userId) throw new InvalidPushDeviceError('User is required');
    return new PushDevice({ userId: input.userId, platform: input.platform as PushPlatform, token });
  }
}
