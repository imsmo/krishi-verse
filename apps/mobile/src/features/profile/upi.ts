// apps/mobile/src/features/profile/upi.ts · PURE helpers for the UPI-IDs manager (screen 180). No React/native —
// unit-tested. A VPA is a public payment address (not a secret). These helpers derive the handle tag for display
// and apply a chosen common-handle to the typed local part. Validity (isValidVpa) + the ₹1 penny-verify live
// elsewhere; the SERVER is the authority on verification (§4/Law 11).

/** Common UPI handles offered as quick chips. These are public payment-handle identifiers (not translatable copy,
 * not user data) — a fixed catalogue the design lists. */
export const COMMON_UPI_HANDLES: readonly string[] = ['@okhdfcbank', '@ybl', '@upi', '@kotak'];

/** The handle portion of a VPA for a display tag, e.g. "ramesh@okaxis" → "@okaxis". Empty when there's no '@'. Pure. */
export function upiHandleTag(vpa: string | null | undefined): string {
  const s = (vpa ?? '').trim();
  const i = s.indexOf('@');
  return i >= 0 ? s.slice(i) : '';
}

/** Apply a chosen "@handle" to the currently-typed value: keeps the local part (before any '@') and appends the
 * handle. "ramesh"+"@ybl" → "ramesh@ybl"; "ramesh@old"+"@ybl" → "ramesh@ybl"; ""+"@upi" → "@upi". Pure. */
export function applyUpiHandle(current: string, handle: string): string {
  const local = (current ?? '').split('@')[0].trim();
  return `${local}${handle}`;
}
