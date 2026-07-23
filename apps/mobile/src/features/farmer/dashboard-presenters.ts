// apps/mobile/src/features/farmer/dashboard-presenters.ts · PURE presenters for the farmer HOME dashboard
// (screen 09). No I/O, no apiClient import (unlike dashboard.api.ts, the data layer, which pulls in
// core/api/client → core/config → expo-constants and therefore can't be imported from a plain node unit test)
// — kept side-effect-free so this is unit-tested directly, mirroring the wallet-home.ts / my-listings.ts split
// between pure logic and network glue.

/** KV-MF-10 (founder video review): the Home wallet stat card degraded to "—" while the dedicated Wallet
 * screen (features/wallet/index.tsx) showed the real balance for the SAME GET /v1/wallet/balance read. This is
 * the pure field mapping dashboard.api.ts's loadWalletBalance() applies to that read — the SAME `availableMinor`
 * field the Wallet screen renders, so the two can never drift onto different figures. A failed/degraded read
 * maps to null — never a fabricated ₹0 — so the screen can tell a genuine failure apart from a real zero balance.
 * R2-01 (founder screenshot review): home.tsx now renders null as a tap-to-retry affordance, not a bare "—"
 * dead-end (a real zero balance still renders normally via MoneyText, since it comes through as '0', not null). */
export function walletTileMinor(b: { availableMinor: string; failed: boolean }): string | null {
  return b.failed ? null : b.availableMinor;
}
