// modules/identity/domain/id-masking.ts · PURE validation + masking for government identifiers (no I/O).
// The RAW number is an INPUT only — it goes ONLY to the eKYC provider over the port and is NEVER persisted or
// logged. These helpers (a) reject malformed input before we ever call the provider (cheap fail-fast, anti-abuse)
// and (b) produce the MASKED form we DO store/return (last-4 for Aadhaar, edge-keep for PAN). DPDP minimisation.

// --- Aadhaar: 12 digits, validated with the UIDAI Verhoeff checksum (the real algorithm, not just a length test).
const D = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],
  [4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],
  [8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0],
];
const P = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],
  [9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
];

/** Verhoeff-valid 12-digit Aadhaar (last digit is the checksum). */
export function isValidAadhaar(raw: string): boolean {
  const s = (raw ?? '').replace(/\s/g, '');
  if (!/^\d{12}$/.test(s)) return false;
  let c = 0;
  const digits = s.split('').reverse().map((d) => Number(d));
  for (let i = 0; i < digits.length; i++) c = D[c][P[i % 8][digits[i]]];
  return c === 0;
}

/** PAN: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F). The 4th char encodes holder type. */
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export function isValidPan(raw: string): boolean { return PAN_RE.test((raw ?? '').trim().toUpperCase()); }

export function isValidId(docType: 'aadhaar' | 'pan', raw: string): boolean {
  return docType === 'aadhaar' ? isValidAadhaar(raw) : isValidPan(raw);
}

/** Aadhaar → 'XXXXXXXX1234' (last 4 only). Caller validated first; defensive on length. */
export function maskAadhaar(raw: string): string {
  const s = (raw ?? '').replace(/\s/g, '');
  const last4 = s.slice(-4);
  return `XXXXXXXX${last4}`;
}
/** PAN → keep the leading entity letter + trailing check letter, mask the rest: 'A******34F' style (edge-keep). */
export function maskPan(raw: string): string {
  const s = (raw ?? '').trim().toUpperCase();
  if (s.length !== 10) return 'XXXXXXXXXX';
  return `${s[0]}XXXX${s.slice(5, 9)}${s[9]}`;   // A + XXXX + 1234 + F  → keeps the 4 digits + edges, hides the 4 entity letters
}
export function maskId(docType: 'aadhaar' | 'pan', raw: string): string {
  return docType === 'aadhaar' ? maskAadhaar(raw) : maskPan(raw);
}
/** The last-4 we persist on the user row (Aadhaar only; PAN has no separate last-4 column). */
export function last4(raw: string): string { return (raw ?? '').replace(/\s/g, '').slice(-4); }
