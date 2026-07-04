// apps/mobile/src/features/labour/apply-job.ts · PURE logic for the worker Apply-for-Job confirm screen (140). No
// React / no SDK I/O (SDK types `import type` → erased) → unit-tested. The apply itself is labour.applyToJob
// (→ applyToBooking, idempotent) in labour.api. This file validates the optional note and gates the CTA on an
// application-eligible booking status. The design's employer NAME, exact TIME-WINDOW, PERKS ("+ lunch"), DISTANCE
// ("5 km") and note PERSISTENCE aren't on the booking/apply contract, so they are never assembled here (§13 — the
// screen degrades them; it never fabricates "Ramesh Patel"/"7 AM–3 PM"/"lunch, chai").

/** Trim + collapse whitespace and cap a free-text note to a sane length (a hostile client can't push a huge blob).
 * Empty → null. NOTE: applyToBooking has no note field yet, so the screen carries this locally + flags it. Pure. */
export function normalizeApplyNote(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return null;
  return s.slice(0, 300);
}

/** A worker may apply only while the booking is still taking applications (open pool). The SERVER remains the
 * authority (a 409/403 is surfaced on submit); this only gates the CTA for UX. Pure. */
export function canApply(status: string | null | undefined): boolean {
  return status === 'open' || status === 'pending';
}
