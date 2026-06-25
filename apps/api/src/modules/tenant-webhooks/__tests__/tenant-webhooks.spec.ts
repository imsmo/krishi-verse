// modules/tenant-webhooks/__tests__/tenant-webhooks.spec.ts · unit tests for the security-critical primitives an
// attacker probes first: the SSRF guard (only public https), the HMAC signature (deterministic + tamper-evident),
// the AES-256-GCM secret-box round-trip (+ tamper rejection), and that the endpoint serialize() never leaks the
// encrypted secret.
import { isSafeWebhookUrl } from '../domain/webhook-ssrf';
import { computeSignature, signatureHeader } from '../domain/webhook-signature';
import { WebhookEndpoint } from '../domain/webhook-endpoint.entity';
import { parseKek, seal, open } from '../../../core/crypto/secret-box';

describe('isSafeWebhookUrl (SSRF guard)', () => {
  it('accepts a public https URL', () => {
    expect(isSafeWebhookUrl('https://hooks.acme.in/kv').ok).toBe(true);
    expect(isSafeWebhookUrl('https://example.com:443/x').ok).toBe(true);
  });
  it('rejects non-https, credentials, odd ports', () => {
    expect(isSafeWebhookUrl('http://acme.in/x').ok).toBe(false);
    expect(isSafeWebhookUrl('https://u:p@acme.in/x').ok).toBe(false);
    expect(isSafeWebhookUrl('https://acme.in:8080/x').ok).toBe(false);
  });
  it('blocks localhost, metadata, .internal/.local', () => {
    for (const u of ['https://localhost/x', 'https://metadata.google.internal/x', 'https://svc.internal/x', 'https://box.local/x']) {
      expect(isSafeWebhookUrl(u).ok).toBe(false);
    }
  });
  it('blocks private + loopback + link-local IP literals (v4 + v6)', () => {
    for (const h of ['https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://192.168.1.1/x', 'https://172.16.0.1/x', 'https://169.254.169.254/x', 'https://100.64.0.1/x']) {
      expect(isSafeWebhookUrl(h).ok).toBe(false);
    }
    expect(isSafeWebhookUrl('https://[::1]/x').ok).toBe(false);
    expect(isSafeWebhookUrl('https://[fd00::1]/x').ok).toBe(false);
  });
});

describe('webhook signature', () => {
  it('is deterministic and changes with body/secret/timestamp', () => {
    const a = computeSignature('whsec_x', '{"a":1}', 1000);
    expect(a).toBe(computeSignature('whsec_x', '{"a":1}', 1000));
    expect(a).not.toBe(computeSignature('whsec_y', '{"a":1}', 1000));
    expect(a).not.toBe(computeSignature('whsec_x', '{"a":2}', 1000));
    expect(a).not.toBe(computeSignature('whsec_x', '{"a":1}', 1001));
    expect(signatureHeader('whsec_x', '{"a":1}', 1000)).toBe(`t=1000,v1=${a}`);
  });
});

describe('secret-box (AES-256-GCM)', () => {
  const kek = parseKek('00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff');
  it('round-trips and is non-reversible without the key', () => {
    const token = seal(kek, 'whsec_supersecret');
    expect(token).not.toContain('whsec_supersecret');
    expect(open(kek, token)).toBe('whsec_supersecret');
  });
  it('rejects a tampered token', () => {
    const token = seal(kek, 'whsec_supersecret');
    const tampered = token.slice(0, -2) + (token.endsWith('A') ? 'BB' : 'AA');
    expect(() => open(kek, tampered)).toThrow();
  });
  it('parseKek rejects a non-32-byte key', () => {
    expect(() => parseKek('deadbeef')).toThrow();
  });
});

describe('WebhookEndpoint.serialize', () => {
  it('exposes url + eventTypes but NEVER the encrypted secret', () => {
    const e = new WebhookEndpoint({ id: 'w1', tenantId: 't1', url: 'https://hooks.acme.in/kv', secretEnc: 'ENCRYPTED_BLOB', eventTypes: ['order.created'], isActive: true, createdAt: '2026-06-01T00:00:00Z' });
    const out = e.serialize() as Record<string, unknown>;
    expect(out.url).toBe('https://hooks.acme.in/kv');
    expect(out.eventTypes).toEqual(['order.created']);
    expect('secretEnc' in out).toBe(false);
    expect(JSON.stringify(out)).not.toContain('ENCRYPTED_BLOB');
  });
});
