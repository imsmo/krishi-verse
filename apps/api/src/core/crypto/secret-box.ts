// core/crypto/secret-box.ts · authenticated symmetric encryption (AES-256-GCM) for secrets that the platform must
// be able to read back (unlike a password hash). Used for webhook SIGNING secrets: the platform shows the secret to
// the tenant ONCE, then must reproduce the HMAC on every delivery, so it stores the secret ENCRYPTED AT REST (never
// plaintext, never a one-way hash). The key (KEK) is 32 bytes from the secret manager (fail-closed in prod).
// Format: base64( iv(12) | authTag(16) | ciphertext ). Pure + deterministic given (key, iv); unit-tested round-trip.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

/** Parse a base64/hex 32-byte key. Throws if it isn't exactly 256 bits (fail-closed). */
export function parseKek(raw: string): Buffer {
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('WEBHOOK_SIGNING_KEK must decode to exactly 32 bytes (256-bit)');
  return key;
}

/** Encrypt plaintext → opaque base64 token. */
export function seal(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

/** Decrypt a token produced by seal(). Throws on tamper (GCM auth) or malformed input. */
export function open(key: Buffer, token: string): string {
  const buf = Buffer.from(token, 'base64');
  if (buf.length < IV_LEN + TAG_LEN) throw new Error('secret-box: malformed token');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
