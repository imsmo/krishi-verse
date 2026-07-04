// apps/mobile/src/features/kyc/aadhaar.ts · PURE helpers for the Aadhaar eKYC-start screen (72). No React/native —
// unit-tested. §4: the RAW Aadhaar number is held ONLY in component state and sent ONLY to the eKYC start endpoint;
// it is NEVER logged, cached, or persisted. These helpers normalise/format/mask the typed value and do a CLIENT-side
// format + Verhoeff-checksum pre-check for UX only — the SERVER (and UIDAI) is the real authority (Law 4/11).

/** Verhoeff multiplication (d), permutation (p) and inverse tables — the UIDAI Aadhaar checksum scheme. */
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** Verhoeff checksum: true when the digit string's trailing check digit is valid. Pure. */
export function verhoeffValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let c = 0;
  const rev = digits.split('').reverse();
  for (let i = 0; i < rev.length; i++) c = D[c][P[i % 8][Number(rev[i])]];
  return c === 0;
}

export const AADHAAR_LENGTH = 12;

/** Keep digits only, capped at 12 — what the input should store as the user types. Pure. */
export function normalizeAadhaar(raw: string): string {
  return (raw ?? '').replace(/\D/g, '').slice(0, AADHAAR_LENGTH);
}

/** Group the typed digits for display: "123456789012" → "1234 5678 9012" (partial groups kept). Pure. */
export function formatAadhaar(digits: string): string {
  return normalizeAadhaar(digits).replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

/** Whether all 12 digits are present (enables the CTA). Pure. */
export function isAadhaarComplete(digits: string): boolean {
  return normalizeAadhaar(digits).length === AADHAAR_LENGTH;
}

/** Client-side validity for UX gating (server re-validates): exactly 12 digits, first digit 2–9 (UIDAI never issues
 * an Aadhaar starting 0 or 1), and a valid Verhoeff checksum. Pure — never a network call. */
export function isValidAadhaar(digits: string): boolean {
  const n = normalizeAadhaar(digits);
  if (n.length !== AADHAAR_LENGTH) return false;
  if (n[0] === '0' || n[0] === '1') return false;
  return verhoeffValid(n);
}

/** PII-safe display mask: only the last 4 digits, never the full number (§4/DPDP). "•••• •••• 9012". Pure. */
export function maskAadhaar(digits: string): string {
  const n = normalizeAadhaar(digits);
  if (n.length !== AADHAAR_LENGTH) return '';
  return `•••• •••• ${n.slice(8)}`;
}
