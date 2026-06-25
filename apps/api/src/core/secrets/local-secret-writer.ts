// core/secrets/local-secret-writer.ts · dev/local adapter for SecretWriter. Returns a deterministic-shaped ref and
// DISCARDS the plaintext — there is no real vault locally and dev must never carry real credentials. Selected only
// outside production; the module factory refuses to bind this in prod (fail-closed).
import { randomUUID } from 'node:crypto';
import { SecretWriter } from './secret-writer.port';

export class LocalSecretWriter implements SecretWriter {
  async putTenantSecret(tenantId: string, providerCode: string, _plaintext: string): Promise<{ secretRef: string }> {
    // The plaintext is intentionally not retained. Ref is non-secret + scoped for traceability.
    return { secretRef: `local://krishi/${tenantId}/${providerCode}/${randomUUID()}` };
  }
  async deleteTenantSecret(_secretRef: string): Promise<void> { /* no-op locally */ }
}
