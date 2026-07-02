// apps/mobile/src/features/listings/fair-price.ts · PURE fair-price band logic for screen 11 (Preview & Publish).
// Compares the listing's price against the market fair-price band (P10..P90 from the market `pulse` prediction —
// real bigint-minor paise, Law 2). No floats, no I/O — unit-tested. The screen renders Low (P10) · You (price) ·
// High (P90) and a status. If no band is available for the crop/region, the screen HIDES the Fair-Price card
// rather than inventing a range (degrade-never-die, never fake).

export type FairStatus = 'below' | 'inRange' | 'above';

export interface FairBand {
  lowMinor: string;   // P10
  highMinor: string;  // P90
  youMinor: string;   // the listing's price
  status: FairStatus;
  /** Position of `you` within [low, high], clamped 0..1 — for the marker on the range bar. */
  position: number;
}

function toBig(s: string | null | undefined): bigint | null {
  if (!s || !/^\d{1,30}$/.test(s)) return null;   // bounded, digits-only → safe BigInt
  try { return BigInt(s); } catch { return null; }
}

/** Build the fair-price band from the listing price + the prediction's P10/P90 (all bigint-minor strings).
 * Returns null when any input is missing/malformed or the band is degenerate (low > high) — the screen then
 * hides the card instead of showing a fake range. */
export function fairBand(youMinor: string, p10Minor: string | null | undefined, p90Minor: string | null | undefined): FairBand | null {
  const you = toBig(youMinor), low = toBig(p10Minor), high = toBig(p90Minor);
  if (you == null || low == null || high == null || low > high) return null;

  const status: FairStatus = you < low ? 'below' : you > high ? 'above' : 'inRange';

  // position = (you - low) / (high - low), clamped to [0,1]. Integer math then a single divide for the % only.
  const span = high - low;
  let position: number;
  if (span === 0n) position = you <= low ? 0 : 1;
  else {
    const clamped = you < low ? low : you > high ? high : you;
    position = Number(clamped - low) / Number(span);
  }
  return { lowMinor: low.toString(), highMinor: high.toString(), youMinor: you.toString(), status, position };
}
