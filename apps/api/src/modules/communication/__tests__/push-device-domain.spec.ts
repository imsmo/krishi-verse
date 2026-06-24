// API-W3 pure-domain test for the push-device registration guard (node-port lane). The SQL upsert +
// owner-scoped revoke run against real Postgres in the integration suite; this asserts the pure
// validation/normalisation the service relies on before it ever touches the DB.
import { PushDevice, PUSH_PLATFORMS } from '../domain/push-device.entity';
import { InvalidPushDeviceError } from '../domain/communication.errors';

describe('PushDevice.register', () => {
  it('accepts a valid (platform, token) and trims the token', () => {
    const d = PushDevice.register({ userId: 'u1', platform: 'android', token: '  ExponentPushToken[abc]  ' });
    expect(d.props).toEqual({ userId: 'u1', platform: 'android', token: 'ExponentPushToken[abc]' });
  });

  it('accepts every supported platform', () => {
    for (const p of PUSH_PLATFORMS) {
      expect(PushDevice.register({ userId: 'u1', platform: p, token: 't' }).props.platform).toBe(p);
    }
  });

  it('rejects an unsupported platform', () => {
    expect(() => PushDevice.register({ userId: 'u1', platform: 'blackberry', token: 't' })).toThrow(InvalidPushDeviceError);
  });

  it('rejects an empty / whitespace-only token', () => {
    expect(() => PushDevice.register({ userId: 'u1', platform: 'ios', token: '   ' })).toThrow(InvalidPushDeviceError);
  });

  it('rejects an oversized token (> 512 chars)', () => {
    expect(() => PushDevice.register({ userId: 'u1', platform: 'ios', token: 'x'.repeat(513) })).toThrow(InvalidPushDeviceError);
  });

  it('rejects a missing user', () => {
    expect(() => PushDevice.register({ userId: '', platform: 'ios', token: 't' })).toThrow(InvalidPushDeviceError);
  });
});
