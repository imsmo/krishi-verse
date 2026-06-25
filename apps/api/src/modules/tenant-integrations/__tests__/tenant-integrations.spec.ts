// modules/tenant-integrations/__tests__/tenant-integrations.spec.ts · unit tests for the security-critical bits:
// (1) the entity serialize() NEVER leaks the vault secretRef; (2) the LocalSecretWriter discards the plaintext and
// returns a scoped, non-secret ref. These are the invariants an attacker probes first.
import { TenantIntegration } from '../domain/tenant-integration.entity';
import { LocalSecretWriter } from '../../../core/secrets/local-secret-writer';

describe('TenantIntegration.serialize', () => {
  const e = new TenantIntegration({
    id: 'i1', tenantId: 't1', providerCode: 'razorpay', secretRef: 'arn:aws:secretsmanager:...:SUPER_SECRET',
    config: { sandbox: true }, isActive: true, providerName: 'Razorpay', category: 'payment', createdAt: '2026-06-01T00:00:00Z',
  });
  it('exposes connected + config but NEVER the secretRef', () => {
    const out = e.serialize() as Record<string, unknown>;
    expect(out.connected).toBe(true);
    expect(out.providerCode).toBe('razorpay');
    expect(out.config).toEqual({ sandbox: true });
    expect('secretRef' in out).toBe(false);
    expect(JSON.stringify(out)).not.toContain('SUPER_SECRET');
  });
  it('connected is false when inactive', () => {
    const off = new TenantIntegration({ id: 'i2', tenantId: 't1', providerCode: 'msg91', secretRef: 'arn:x', config: {}, isActive: false });
    expect((off.serialize() as any).connected).toBe(false);
  });
});

describe('LocalSecretWriter', () => {
  it('returns a tenant+provider scoped ref and discards the plaintext', async () => {
    const w = new LocalSecretWriter();
    const { secretRef } = await w.putTenantSecret('t1', 'razorpay', 'rzp_live_supersecret');
    expect(secretRef.startsWith('local://krishi/t1/razorpay/')).toBe(true);
    expect(secretRef).not.toContain('supersecret');
    await expect(w.deleteTenantSecret(secretRef)).resolves.toBeUndefined();
  });
});
