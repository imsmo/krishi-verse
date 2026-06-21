// apps/mobile/src/core/flags/flags.ts · client feature flags + KILL-SWITCH (Law 10 / guide §6). Every shippable
// feature is gated here so ops can disable a bad screen remotely WITHOUT an app-store release. Resolution order
// (highest wins): remote config (hydrated at boot from the server) → build-time env override
// (EXPO_PUBLIC_FLAGS="voice_listing=on,listing_boost=off") → the hard-coded DEFAULTS below. New/risky features
// default OFF; only verified, shipped verticals default ON. Pure + framework-free → unit-tested.

export type FlagKey =
  | 'farmer_app'        // the farmer role vertical (shipped Wave 0) — GA-intended, killable
  | 'voice_listing'     // mic→STT listing (infra not built yet) — OFF
  | 'listing_boost'     // paid boost via wallet — OFF until payments land
  | 'payments_addmoney' // wallet add-money via Razorpay (P-03) — OFF until staging-verified
  | 'wallet'            // wallet vertical: transactions/withdraw/payout-history/detail (P-06) — OFF until verified
  | 'orders_fulfilment' // order lifecycle actions + PoD + track + review + report (P-07) — OFF until verified
  | 'buyer_checkout'    // buyer cart → checkout → place+pay order (P-09) — OFF until verified
  | 'offers_chat'       // offers negotiation + chat + masked call (P-10) — OFF until verified
  | 'auctions'          // auction discovery + bidding (EMD) + create (P-11) — OFF until verified
  | 'worker_active_job' // worker active-job: attendance geofence + earnings + withdraw + reviews (P-13) — OFF
  | 'kyc'               // KYC doc submit/status (P-03) — OFF until staging-verified
  | 'notifications'     // push + in-app notification center (P-04) — OFF until staging-verified
  | 'buyer_app' | 'worker_app' | 'trader_app' | 'ambassador_app' | 'tenant_admin_lite'; // future verticals — OFF

// Defaults: OFF unless the vertical is built AND verified. Flip a future vertical's default to true only when it
// ships; production can still kill any of these via remote config.
const DEFAULTS: Record<FlagKey, boolean> = {
  farmer_app: true,
  voice_listing: false,
  listing_boost: false,
  payments_addmoney: false,
  wallet: false,
  orders_fulfilment: false,
  buyer_checkout: false,
  offers_chat: false,
  auctions: false,
  worker_active_job: false,
  kyc: false,
  notifications: false,
  buyer_app: false,
  worker_app: false,
  trader_app: false,
  ambassador_app: false,
  tenant_admin_lite: false,
};

function parseEnvOverrides(raw: string | undefined): Partial<Record<FlagKey, boolean>> {
  if (!raw) return {};
  const out: Partial<Record<FlagKey, boolean>> = {};
  for (const pair of raw.split(',')) {
    const [k, v] = pair.split('=').map((s) => s.trim());
    if (k && k in DEFAULTS) out[k as FlagKey] = v === 'on' || v === 'true' || v === '1';
  }
  return out;
}

class FlagStore {
  private remote: Partial<Record<FlagKey, boolean>> = {};
  private readonly env = parseEnvOverrides(process.env.EXPO_PUBLIC_FLAGS);
  private readonly listeners = new Set<() => void>();

  /** Hydrate from the server's remote-config payload (call once at boot, then on refresh). Unknown keys ignored.
   * This is the KILL-SWITCH channel: setting a key false here disables the feature for everyone, instantly. */
  hydrate(remote: Partial<Record<string, boolean>>): void {
    const next: Partial<Record<FlagKey, boolean>> = {};
    for (const k of Object.keys(DEFAULTS) as FlagKey[]) if (k in remote) next[k] = !!remote[k];
    this.remote = next;
    this.listeners.forEach((l) => l());
  }

  isEnabled(key: FlagKey): boolean {
    if (key in this.remote) return this.remote[key]!;   // remote wins (kill-switch)
    if (key in this.env) return this.env[key]!;          // then build-time override
    return DEFAULTS[key];                                // then default (OFF for new features)
  }

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
}

export const flags = new FlagStore();
export function isEnabled(key: FlagKey): boolean { return flags.isEnabled(key); }
