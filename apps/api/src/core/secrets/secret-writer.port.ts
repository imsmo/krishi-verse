// core/secrets/secret-writer.port.ts · PORT for writing a tenant's third-party credential into a managed secret
// store and getting back an opaque reference (Law: never store raw provider secrets in our DB — only a vault ref).
// Real adapter = AWS Secrets Manager (prod). Dev/local adapter = a no-op that returns a ref and DISCARDS the
// plaintext (dev must never use real credentials). The dev path must NEVER be active in production — the module
// factory fails closed at boot if prod isn't bound to the real adapter.
export const SECRET_WRITER = Symbol('SECRET_WRITER');

export interface SecretWriter {
  /** Store `plaintext` under a tenant+provider scoped name; return the opaque ref persisted on the row. */
  putTenantSecret(tenantId: string, providerCode: string, plaintext: string): Promise<{ secretRef: string }>;
  /** Best-effort delete on disconnect (idempotent; a missing secret is not an error). */
  deleteTenantSecret(secretRef: string): Promise<void>;
}
