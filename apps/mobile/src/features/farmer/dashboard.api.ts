// apps/mobile/src/features/farmer/dashboard.api.ts · data layer for the farmer HOME dashboard (screen 09).
// Keeps the screen thin (guide §3): the screen calls loadFarmerHome() and renders; all SDK access + degrade
// logic lives here. Mandi pulse is best-effort — on failure it returns null so the screen HIDES the section
// rather than inventing prices (degrade-never-die, never fake data). Money stays as bigint-minor strings.
import { apiClient } from '../../core/api/client';
import { cache } from '../../core/offline/sqlite.db';
import { currentScope } from '../../core/offline/scope';
import { POLICY } from '../../core/offline/cache-policies';
import { myListings } from '../listings/listings.api';
import { walletBalance } from '../wallet/wallet.api';
import { listTips } from '../content/content.api';

export interface MandiRow { id: string; commodity: string; modalPriceMinor: string; changePct: number }
export interface HomeTip { id: string; title: string; body: string; kind: string }

export interface FarmerHome {
  listingCount: number | null;
  mandi: MandiRow[] | null;
  /** Reconciled wallet balance (server-truth, bigint-minor) or null when the read failed — the screen shows "—". */
  walletBalanceMinor: string | null;
  /** Today's curated tip (first approved learning resource) or null — the screen hides the section. */
  tip: HomeTip | null;
}

export async function loadFarmerHome(): Promise<FarmerHome> {
  const [listingCount, mandi, walletBalanceMinor, tip] = await Promise.all([
    loadListingCount(), loadMandiPulse(), loadWalletBalance(), loadTodaysTip(),
  ]);
  return { listingCount, mandi, walletBalanceMinor, tip };
}

// Wallet balance — server-truth; degrade to null (screen shows "—") rather than a fake ₹0. (Law 2/12)
async function loadWalletBalance(): Promise<string | null> {
  try { const b = await walletBalance(); return b.failed ? null : b.availableMinor; }
  catch { return null; }
}

// Today's tip — first curated learning resource; best-effort, hides the card on failure (never fakes). (Law 12)
async function loadTodaysTip(): Promise<HomeTip | null> {
  try {
    const { items } = await listTips();
    const r = items[0] as { id: string; title: string; body?: string; kind?: string } | undefined;
    return r ? { id: r.id, title: r.title, body: r.body ?? '', kind: r.kind ?? 'tip' } : null;
  } catch { return null; }
}

async function loadListingCount(): Promise<number | null> {
  try { const page = await myListings(undefined, 50); return page.items.length; }
  catch { return null; }
}

// Assumed contract: GET /v1/market-intel/mandi-prices?limit= → { data: MandiRow[] } (market-intel module).
// Read-through SWR cache (mandi prices are public + reference-ish, usable offline). Returns null on a hard
// failure with no cache, so the home screen hides the pulse section instead of showing zeros/fakes.
async function loadMandiPulse(): Promise<MandiRow[] | null> {
  try {
    const { value } = await cache.read<MandiRow[]>({
      scope: currentScope(), ns: 'mandi.pulse', parts: [6], policy: POLICY.shortList,
      fetcher: async () => (await apiClient().request<MandiRow[]>('GET', 'market-intel/mandi-prices', { query: { limit: 6 } })).data ?? [],
    });
    return value;
  } catch { return null; }
}
