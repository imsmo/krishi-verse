// apps/mobile/src/core/push/notification-router.ts · PURE deep-link routing for a tapped/opened notification.
// Given the notification payload (+ eventCode), compute the in-app route to open. SECURITY (guide §4 deep links):
// a payload.deepLink is honored ONLY if it's an internal absolute path ("/(...)" or "/...") — never an external
// scheme/URL — so a crafted push can't redirect the user off-app or auto-trigger an action; otherwise we map by
// eventCode prefix to a safe destination, defaulting to the inbox. The server still re-authorizes whatever the
// destination screen loads (no trust in the push). Unit-tested.

const SAFE_INTERNAL_PATH = /^\/[A-Za-z0-9()_\-/[\]:.?=&]*$/; // internal route path only; no scheme, no "//host"

function eventRoute(eventCode: string): string {
  const e = eventCode.toLowerCase();
  if (e.startsWith('order')) return '/(farmer)/orders';
  if (e.startsWith('listing')) return '/(farmer)/listings';
  if (e.startsWith('payment') || e.startsWith('wallet') || e.startsWith('payout')) return '/(farmer)/wallet';
  if (e.startsWith('kyc')) return '/(farmer)/kyc';
  return '/(farmer)/notifications';
}

/** Resolve the route to open for a notification. Always returns a safe internal path. */
export function routeForNotification(payload: Record<string, unknown> | undefined | null, eventCode = ''): string {
  const dl = payload?.deepLink;
  if (typeof dl === 'string' && !dl.startsWith('//') && SAFE_INTERNAL_PATH.test(dl)) return dl;
  return eventRoute(eventCode || String(payload?.eventCode ?? ''));
}
