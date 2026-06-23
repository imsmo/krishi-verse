// apps/web-storefront/src/features/cart/summary.ts · the cart badge's data source. Server-only. Anonymous
// visitors have no cart, so we skip the network entirely; for signed-in users we read the authoritative cart via
// the authed SDK and return the number of distinct line items. Any failure (flaky API, expired session) degrades
// to 0 rather than breaking the header on every page (Law 12).
import 'server-only';
import { serverClient } from '../../lib/api-client';
import { hasSessionCookie } from '../../lib/auth';

export async function getCartItemCount(): Promise<number> {
  if (!hasSessionCookie()) return 0;
  try {
    const cart = await serverClient().cart.get();
    return cart.items.length;
  } catch {
    return 0;
  }
}
