// apps/mobile/src/features/tenant/web-console.ts · PURE web-console handoff logic for tenant-admin-lite P-18. No
// React/native → unit-tested. The mobile app is a LITE console: analytics/reports/export/broadcast/branding/etc.
// are heavy editing that lives on the web console (apps/web-tenant). These helpers (a) catalogue the 15 core
// reports as metadata (i18n keys — NOT fabricated data; the numbers are viewed on web), and (b) build + validate
// a safe https URL into the console (anti open-redirect: only allowlisted relative paths, never a client-supplied
// absolute URL). NO money/PII here.

/** The 15 core reports a tenant can view (catalogue metadata). Each routes to its web-console report page; the
 * mobile app does not render the figures (there's no analytics read API yet — see README flagged gap). */
export interface ReportDescriptor { id: string; titleKey: string; path: string }
export const CORE_REPORTS: ReadonlyArray<ReportDescriptor> = Object.freeze([
  { id: 'gmv', titleKey: 'owner.report.gmv', path: '/reports/gmv' },
  { id: 'orders', titleKey: 'owner.report.orders', path: '/reports/orders' },
  { id: 'revenue', titleKey: 'owner.report.revenue', path: '/reports/revenue' },
  { id: 'settlements', titleKey: 'owner.report.settlements', path: '/reports/settlements' },
  { id: 'refunds', titleKey: 'owner.report.refunds', path: '/reports/refunds' },
  { id: 'top_products', titleKey: 'owner.report.topProducts', path: '/reports/top-products' },
  { id: 'top_sellers', titleKey: 'owner.report.topSellers', path: '/reports/top-sellers' },
  { id: 'active_farmers', titleKey: 'owner.report.activeFarmers', path: '/reports/active-farmers' },
  { id: 'live_listings', titleKey: 'owner.report.liveListings', path: '/reports/live-listings' },
  { id: 'disputes', titleKey: 'owner.report.disputes', path: '/reports/disputes' },
  { id: 'payouts', titleKey: 'owner.report.payouts', path: '/reports/payouts' },
  { id: 'commissions', titleKey: 'owner.report.commissions', path: '/reports/commissions' },
  { id: 'memberships', titleKey: 'owner.report.memberships', path: '/reports/memberships' },
  { id: 'fees', titleKey: 'owner.report.fees', path: '/reports/fees' },
  { id: 'traffic', titleKey: 'owner.report.traffic', path: '/reports/traffic' },
]);

/** Named web-console handoff targets (heavy editing). Relative paths only — never client-supplied URLs. */
export const WEB_PATHS = Object.freeze({
  customReport: '/reports/custom',
  export: '/reports/export',
  broadcast: '/broadcasts/new',
  campaigns: '/broadcasts',
  paymentSettings: '/settings/payments',
  notifications: '/settings/notifications',
  integrations: '/settings/integrations',
  compliance: '/settings/compliance',
  branding: '/settings/branding',
  bulkActions: '/bulk',
  billing: '/settings/billing',
});

/** A safe relative console path: starts with a single '/', no scheme, no protocol-relative '//', no '..', no
 * whitespace/control chars. (Anti open-redirect / injection — the server also scopes by tenant.) */
export function isSafeWebPath(path: string): boolean {
  if (typeof path !== 'string' || path.length === 0 || path.length > 512) return false;
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path.includes('..') || /[\s\\]/.test(path)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return false; // any scheme prefix
  return /^\/[A-Za-z0-9\-._~/?#%=&]*$/.test(path);
}

/** Join an https console origin + a safe relative path. Returns null if the base isn't https or the path is
 * unsafe — callers then show "console not configured" instead of opening a bad URL. */
export function buildWebUrl(base: string | undefined, path: string): string | null {
  if (!base || !/^https:\/\/[^\s/]+/i.test(base)) return null;
  if (!isSafeWebPath(path)) return null;
  return base.replace(/\/+$/, '') + path;
}
