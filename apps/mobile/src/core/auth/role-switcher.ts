// apps/mobile/src/core/auth/role-switcher.ts · the multi-role model (PRD: one account, many hats). The catalog
// of selectable roles, the mapping from a server permission/role string to an app role, and which home route a
// role lands on. Pure data + helpers (testable). The SERVER is the authority on what a user may actually do —
// these roles only drive navigation + which dashboard to show.
export type AppRole = 'farmer' | 'buyer' | 'trader' | 'owner' | 'ambassador';

export interface RoleDef { role: AppRole; i18nKey: string; descKey: string; homeRoute: string; }

export const ROLES: readonly RoleDef[] = Object.freeze([
  { role: 'farmer', i18nKey: 'role.farmer', descKey: 'role.farmer.desc', homeRoute: '/(farmer)/home' },
  { role: 'buyer', i18nKey: 'role.buyer', descKey: 'role.buyer.desc', homeRoute: '/(buyer)/home' },
  { role: 'trader', i18nKey: 'role.trader', descKey: 'role.trader.desc', homeRoute: '/(trader)/home' },
  { role: 'owner', i18nKey: 'role.owner', descKey: 'role.owner.desc', homeRoute: '/(owner)/home' },
  { role: 'ambassador', i18nKey: 'role.ambassador', descKey: 'role.ambassador.desc', homeRoute: '/(ambassador)/home' },
]);

const BY_ROLE = new Map(ROLES.map((r) => [r.role, r]));
const VALID = new Set<string>(ROLES.map((r) => r.role));

export function isAppRole(s: string | undefined | null): s is AppRole { return !!s && VALID.has(s); }

/** Where to send the user after auth, given their active role. Farmer is the default landing. */
export function homeRouteFor(role: string | undefined): string {
  return (isAppRole(role) && BY_ROLE.get(role)?.homeRoute) || '/(farmer)/home';
}

/** Pick a sensible default active role from the server profile's role list (first known app role, else farmer). */
export function defaultActiveRole(serverRoles: string[]): AppRole {
  const match = serverRoles.find((r) => VALID.has(r)) as AppRole | undefined;
  return match ?? 'farmer';
}
