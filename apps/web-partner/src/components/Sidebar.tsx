// apps/web-partner/src/components/Sidebar.tsx · partner-portal chrome (server component). PERSONA-AWARE: it reads
// the partner's `perms` claim and shows the Lending group (loan.manage), the Fleet group (logistics.manage), or
// both (`*`). Within a visible group, only built routes (`live`) render as real links; not-yet-built surfaces
// render as a non-link "(soon)" label. Partner RBAC + RLS are enforced by the platform API per call — this nav
// reflects route existence + persona, never grants access. Sign-out posts to the logout route (clears the
// httpOnly cookies). No inline styles — all via token-driven CSS classes.
import Link from 'next/link';
import { getTranslator } from '../lib/i18n';
import { getPartnerPermissions } from '../lib/partner-auth';
import { liveNavForPartner, soonNavForPartner } from '../features/nav/nav-model';

export function Sidebar() {
  const t = getTranslator();
  const perms = getPartnerPermissions();
  const live = liveNavForPartner(perms);
  const soon = soonNavForPartner(perms);
  return (
    <nav className="kv-sidebar" aria-label={t.t('nav.primary')}>
      <Link href="/dashboard" className="kv-brand">{t.t('nav.brand')}</Link>
      <ul className="kv-sidebar__nav">
        {live.map((n) => (
          <li key={n.href}><Link href={n.href} className="kv-sidebar__link">{t.t(n.labelKey)}</Link></li>
        ))}
        {soon.map((n) => (
          <li key={n.href}>
            <span className="kv-sidebar__soon" title={t.t('nav.soonTitle')}>{t.t(n.labelKey)} <span className="kv-muted">{t.t('nav.soon')}</span></span>
          </li>
        ))}
      </ul>
      <form action="/api/session" method="post" className="kv-sidebar__foot">
        <input type="hidden" name="_action" value="logout" />
        <button type="submit" className="kv-btn kv-btn--muted">{t.t('nav.signOut')}</button>
      </form>
    </nav>
  );
}
