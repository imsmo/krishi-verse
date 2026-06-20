// apps/mobile/src/core/util/ids.ts · stable id/idempotency-key generation. Uses expo-crypto's cryptographically
// strong randomUUID (so two devices never collide a key, and a mutation can't be confused for another's — Law 3).
import * as Crypto from 'expo-crypto';

export function newId(): string {
  return Crypto.randomUUID();
}
