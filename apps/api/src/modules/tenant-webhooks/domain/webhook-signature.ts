// modules/tenant-webhooks/domain/webhook-signature.ts · PURE HMAC signing for outbound webhooks (Stripe-style).
// The signed string is `${timestamp}.${rawBody}` so the receiver can reject replays; the tenant verifies with the
// signing secret we showed them once. Header value: `t=<unix>,v1=<hex hmac-sha256>`. Deterministic + unit-tested.
import { createHmac } from 'node:crypto';

export const SIGNATURE_HEADER = 'X-KV-Signature';
export const TIMESTAMP_HEADER = 'X-KV-Timestamp';

/** Compute the v1 hex signature over `${timestampSec}.${body}`. */
export function computeSignature(secret: string, body: string, timestampSec: number): string {
  return createHmac('sha256', secret).update(`${timestampSec}.${body}`).digest('hex');
}

/** Build the full signature header value. */
export function signatureHeader(secret: string, body: string, timestampSec: number): string {
  return `t=${timestampSec},v1=${computeSignature(secret, body, timestampSec)}`;
}
