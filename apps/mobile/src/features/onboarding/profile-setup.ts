// apps/mobile/src/features/onboarding/profile-setup.ts · PURE logic for screen 05 (Set Up Profile). Owns the
// farm-size vocabulary, client-side validation (name required; pincode + UPI optional but format-checked), and
// the assembly of the real WRITE payloads from the form. No I/O here — unit-tested. The screen calls
// buildSetupWrites() and the api layer (profile-setup.api.ts) executes the resulting writes. The server
// re-validates everything (the client checks are for UX only — §4).

export type FarmSize = 'small' | 'medium' | 'large';
export const FARM_SIZES: readonly FarmSize[] = Object.freeze(['small', 'medium', 'large']);

export interface ProfileSetupForm {
  fullName: string;
  village: string;
  pincode: string;
  farmSize: FarmSize | null;
  upiId: string;
  /** Set once a picked avatar has been uploaded (mediaId from core/media); null while pending/none. */
  photoMediaId?: string | null;
  /** Captured GPS fix (lat/lng) if the user tapped "Detect via GPS"; no reverse-geocode is done client-side. */
  gps?: { lat: number; lng: number } | null;
}

export const EMPTY_SETUP_FORM: ProfileSetupForm = Object.freeze({
  fullName: '', village: '', pincode: '', farmSize: null, upiId: '', photoMediaId: null, gps: null,
});

// Indian 6-digit PIN: first digit 1-9, then 5 digits. Anchored + fixed length → no ReDoS.
const PINCODE_RE = /^[1-9][0-9]{5}$/;
// UPI VPA: handle@psp. Conservative, bounded character classes (no catastrophic backtracking).
const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-_]{1,63}$/;

export function isValidPincode(p: string): boolean {
  return PINCODE_RE.test(p.trim());
}
export function isValidUpi(v: string): boolean {
  return UPI_RE.test(v.trim());
}

/** What submit must persist. `profilePatch` → PATCH /users/me (real); `upiId` → bank-accounts add (real);
 * `extras` (village/pincode/farmSize/gps) have NO profile-write contract yet → the api persists them locally
 * and FLAGS the gap (never faked as a server save). `reason` names the first failed field for inline copy. */
export interface SetupWrites {
  ok: boolean;
  reason?: 'name' | 'pincode' | 'upi';
  profilePatch?: { fullName: string; photoMediaId?: string };
  upiId?: string;
  extras: { village: string; pincode: string; farmSize: FarmSize | null; gps: { lat: number; lng: number } | null };
}

export function buildSetupWrites(form: ProfileSetupForm): SetupWrites {
  const name = (form.fullName ?? '').trim();
  const village = (form.village ?? '').trim();
  const pincode = (form.pincode ?? '').trim();
  const upi = (form.upiId ?? '').trim();
  const extras = { village, pincode, farmSize: form.farmSize ?? null, gps: form.gps ?? null };

  if (!name || name.length > 200) return { ok: false, reason: 'name', extras };
  if (pincode && !isValidPincode(pincode)) return { ok: false, reason: 'pincode', extras };
  if (upi && !isValidUpi(upi)) return { ok: false, reason: 'upi', extras };

  const profilePatch: { fullName: string; photoMediaId?: string } = { fullName: name };
  if (form.photoMediaId) profilePatch.photoMediaId = form.photoMediaId;

  return { ok: true, profilePatch, upiId: upi || undefined, extras };
}
