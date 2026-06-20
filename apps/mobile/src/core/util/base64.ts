// apps/mobile/src/core/util/base64.ts · pure base64 → bytes decode. expo-file-system reads a file as a base64
// string; we decode it to the exact raw bytes so we can SHA-256 the SAME bytes that get uploaded (integrity,
// guide §4). Dependency-free + unit-tested. Tolerates standard base64 (with/without padding).
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) t[ALPHABET.charCodeAt(i)] = i;
  return t;
})();

/** Decode a base64 string to a Uint8Array. Ignores whitespace; throws on invalid characters. */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[\r\n\t ]/g, '').replace(/=+$/, '');
  const len = clean.length;
  const outLen = Math.floor((len * 6) / 8);
  const out = new Uint8Array(outLen);
  let bits = 0; let acc = 0; let oi = 0;
  for (let i = 0; i < len; i++) {
    const v = LOOKUP[clean.charCodeAt(i)];
    if (v < 0) throw new Error('invalid base64 character');
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) { bits -= 8; out[oi++] = (acc >> bits) & 0xff; }
  }
  return out;
}

/** Byte length encoded by a base64 string (without decoding) — handy for a quick size check. */
export function base64ByteLength(b64: string): number {
  const clean = b64.replace(/[\r\n\t ]/g, '');
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - pad;
}
