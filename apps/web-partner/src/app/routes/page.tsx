// apps/web-partner/src/app/routes/page.tsx · the partner's Village Run routes (GET logistics/routes). active-only
// toggle + optional run-weekday filter + keyset (?cursor=) + create (POST, Idempotency-Key). Section nav across the
// logistics network. Degrade-never-die. All copy via i18n; no inline styles; noindex.
import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePartner } from '../../lib/session';
import { partnerClient } from '../../lib/api-client';
import { DataTable, Column } from '../../components/DataTable';
import { getTranslator } from '../../lib/i18n';
import { parseActiveOnly, WEEKDAYS, weekdayKey, type RouteRow } from '../../features/logistics/network';
import { createRouteAction } from './actions';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('net.routesTitle'), robots: { index: false, follow: false } };
}

const ERR = new Set(['routeName', 'runWeekday', 'villageRegionIds', 'vehicleId', 'consolidationUserId', 'noChange', 'forbidden', 'conflict', 'notFound', 'generic']);

function NetworkNav({ active }: { active: 'zones' | 'routes' | 'cold' }) {
  const t = getTranslator();
  return (
    <nav className="kv-filters" aria-label={t.t('net.nav')}>
      <Link href="/zones" className={`kv-chip${active === 'zones' ? ' is-active' : ''}`} aria-current={active === 'zones' ? 'true' : undefined}>{t.t('net.navZones')}</Link>
      <Link href="/routes" className={`kv-chip${active === 'routes' ? ' is-active' : ''}`} aria-current={active === 'routes' ? 'true' : undefined}>{t.t('net.navRoutes')}</Link>
      <Link href="/cold-chain" className={`kv-chip${active === 'cold' ? ' is-active' : ''}`} aria-current={active === 'cold' ? 'true' : undefined}>{t.t('net.navCold')}</Link>
    </nav>
  );
}

export default async function RoutesPage({ searchParams }: { searchParams: { active?: string; runWeekday?: string; cursor?: string; ok?: string; error?: string } }) {
  await requirePartner();
  const t = getTranslator();
  const activeOnly = parseActiveOnly(searchParams.active);
  const wdRaw = (searchParams.runWeekday ?? '').trim();
  const runWeekday = /^[0-6]$/.test(wdRaw) ? wdRaw : '';

  let rows: RouteRow[] = [];
  let nextCursor: string | undefined;
  let notice: string | undefined;
  try {
    const res = await partnerClient().request<RouteRow[]>('GET', 'logistics/routes', { query: { activeOnly, runWeekday: runWeekday === '' ? undefined : runWeekday, cursor: searchParams.cursor } });
    rows = res.data ?? [];
    nextCursor = (res.meta?.nextCursor as string | undefined) ?? undefined;
  } catch { notice = t.t('dash.unavailable'); }

  const okCreated = searchParams.ok === 'created';
  const errKey = searchParams.error && ERR.has(searchParams.error) ? searchParams.error : null;
  const moreHref = () => {
    const p = new URLSearchParams();
    if (!activeOnly) p.set('active', 'false');
    if (runWeekday !== '') p.set('runWeekday', runWeekday);
    if (nextCursor) p.set('cursor', nextCursor);
    return `/routes?${p.toString()}`;
  };
  const wdHref = (wd: string) => {
    const p = new URLSearchParams();
    if (!activeOnly) p.set('active', 'false');
    if (wd !== '') p.set('runWeekday', wd);
    const qs = p.toString();
    return qs ? `/routes?${qs}` : '/routes';
  };

  const columns: Column<RouteRow>[] = [
    { header: t.t('net.colName'), cell: (r) => <Link href={`/routes/${r.id}`}>{r.defaultName}</Link> },
    { header: t.t('net.colRunDay'), cell: (r) => t.t(weekdayKey(r.runWeekday)) },
    { header: t.t('net.colVillages'), cell: (r) => String(r.villageRegionIds.length) },
    { header: t.t('net.colActive'), cell: (r) => <span className={`kv-status kv-status--${r.isActive ? 'ok' : 'muted'}`}>{t.t(r.isActive ? 'common.active' : 'common.inactive')}</span> },
  ];

  return (
    <section>
      <h1>{t.t('net.routesTitle')}</h1>
      <p className="kv-muted">{t.t('net.routesLead')}</p>
      <NetworkNav active="routes" />
      {okCreated && <p className="kv-success" role="status">{t.t('net.ok.created')}</p>}
      {errKey && <p className="kv-error" role="alert">{t.t(`net.err.${errKey}`)}</p>}

      <nav className="kv-filters" aria-label={t.t('net.filterRunDay')}>
        <Link href={wdHref('')} className={`kv-chip${runWeekday === '' ? ' is-active' : ''}`} aria-current={runWeekday === '' ? 'true' : undefined}>{t.t('net.wd.any')}</Link>
        {WEEKDAYS.map((d) => (
          <Link key={d} href={wdHref(String(d))} className={`kv-chip${runWeekday === String(d) ? ' is-active' : ''}`} aria-current={runWeekday === String(d) ? 'true' : undefined}>{t.t(weekdayKey(d))}</Link>
        ))}
      </nav>
      <nav className="kv-filters" aria-label={t.t('common.filter')}>
        <Link href={`/routes${runWeekday !== '' ? `?runWeekday=${runWeekday}` : ''}`} className={`kv-chip${activeOnly ? ' is-active' : ''}`} aria-current={activeOnly ? 'true' : undefined}>{t.t('net.filterActive')}</Link>
        <Link href={`/routes?active=false${runWeekday !== '' ? `&runWeekday=${runWeekday}` : ''}`} className={`kv-chip${!activeOnly ? ' is-active' : ''}`} aria-current={!activeOnly ? 'true' : undefined}>{t.t('net.filterAll')}</Link>
      </nav>

      {notice ? <p className="kv-error" role="alert">{notice}</p> : (
        <>
          <DataTable columns={columns} rows={rows} empty={t.t('net.routesEmpty')} />
          {nextCursor && <p className="kv-pager"><Link className="kv-btn" href={moreHref()}>{t.t('common.nextPage')}</Link></p>}
        </>
      )}

      <details className="kv-card kv-limit-form">
        <summary className="kv-card__title">{t.t('net.createRoute')}</summary>
        <form action={createRouteAction} className="kv-form">
          <label htmlFor="r-name" className="kv-field__label">{t.t('net.routeName')}</label>
          <input id="r-name" name="defaultName" className="kv-input" required maxLength={150} />
          <label htmlFor="r-wd" className="kv-field__label">{t.t('net.runWeekday')}</label>
          <select id="r-wd" name="runWeekday" className="kv-input" defaultValue="">
            <option value="">{t.t('net.wd.any')}</option>
            {WEEKDAYS.map((d) => <option key={d} value={d}>{t.t(weekdayKey(d))}</option>)}
          </select>
          <label htmlFor="r-villages" className="kv-field__label">{t.t('net.villageRegionIds')}</label>
          <textarea id="r-villages" name="villageRegionIds" className="kv-input" rows={2} placeholder={t.t('net.regionIdsHint')} />
          <label htmlFor="r-vehicle" className="kv-field__label">{t.t('net.vehicleId')}</label>
          <input id="r-vehicle" name="vehicleId" className="kv-input" placeholder={t.t('net.uuidHint')} />
          <label htmlFor="r-consol" className="kv-field__label">{t.t('net.consolidationUserId')}</label>
          <input id="r-consol" name="consolidationUserId" className="kv-input" placeholder={t.t('net.uuidHint')} />
          <button type="submit" className="kv-btn">{t.t('net.createRouteSubmit')}</button>
        </form>
      </details>
    </section>
  );
}
