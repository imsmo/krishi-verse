// apps/mobile/src/features/cart/review-order.ts · PURE logic for the single-page "Review Order" checkout (screen
// 15). No React/native deps (SDK types are `import type` → erased) → unit-tested. Money is bigint minor-unit
// strings elsewhere (Law 2); this file only derives UI state (which payment rail, item subtitle) and never sums
// money. The authoritative bill (subtotal/delivery/platform-fee/discount/total) is the SERVER's CheckoutPreview.

/** The payment rails Review Order offers. `wallet` pays from the KV wallet balance; `upi` and `card` both resolve
 * to the SAME secure gateway sheet (the instrument — a VPA/card — is chosen INSIDE the sheet, never stored or shown
 * by us, §13/§4). We split them into two rows only for design parity; both are online-gateway payments. */
export type ReviewRail = 'wallet' | 'upi' | 'card';

/** True for the wallet rail (pay from balance). Pure. */
export function isWalletRail(rail: ReviewRail): boolean {
  return rail === 'wallet';
}

/** True for an online-gateway rail (UPI or Card) — both route through the gateway; the actual instrument is chosen
 * in the secure sheet. Pure. */
export function isOnlineRail(rail: ReviewRail): boolean {
  return rail === 'upi' || rail === 'card';
}

/** Whether a rail can be chosen right now. The wallet rail is selectable only when the balance covers the total
 * (never let the buyer pick a rail that can't pay); online rails are always selectable. Pure. */
export function railSelectable(rail: ReviewRail, walletCovers: boolean): boolean {
  return rail === 'wallet' ? walletCovers : true;
}

/** The default rail on open: the online gateway (UPI) is the recommended, always-available rail — matching the
 * multi-step payment screen. Pure (no wallet auto-select even when it covers, so the buyer opts in explicitly). */
export function defaultRail(): ReviewRail {
  return 'upi';
}

/** The order-item subtitle: quantity + its unit label (e.g. "2 quintal") when the server preview carries a unit
 * code, else the bare quantity. §13: grade and seller name are NOT in the cart/preview contract → never fabricated
 * into this line. Non-finite quantity degrades to 0. Pure. */
export function checkoutItemSubtitle(quantity: number, unitCode?: string | null): string {
  const q = Number.isFinite(quantity) ? quantity : 0;
  const u = (unitCode ?? '').trim();
  return u ? `${q} ${u}` : `${q}`;
}
