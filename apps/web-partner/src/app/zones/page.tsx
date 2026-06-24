// apps/web-partner/src/app/zones/page.tsx · the partner's delivery serviceability zones (GET logistics/zones).
// active-only toggle + optional pincode filter + keyset (?cursor=) + create (POST, Idempotency-Key). Section nav
// across the logistics network (Zones | Routes | Cold-chain). Degrade-never-die. All copy via i18n; no inline
// styles; noindex.
import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePartner } from '../../lib/session';
import { partnerClient } from '../../lib/api-client';
import { DataTable, Column } from '../../components/DataTable';
import { getTranslator } from '../../lib/i18n';
import { parseActiveOnly, type ZoneRow } from '../../features/logistics/network';
import { createZoneAction } from './actions';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('net.zonesTitle'), robots: { index: false, follow: false } };
}

const ERR = new Set(['zoneName', 'pincodes', 'regionIds', 'chargeDefinitionId', 'noChange', 'forbidden', 'conflict', 'notFound', 'generic']);

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

export default async function ZonesPage({ searchParams }: { searchParams: { active?: string; pincode?: string; cursor?: string; ok?: string; error?: string } }) {
  await requirePartner();
  const t = getTranslator();
  const activeOnly = parseActiveOnly(searchParams.active);
  const pincode = (searchParams.pincode ?? '').trim();

  let rows: ZoneRow[] = [];
  let nextCursor: string | undefined;
  let notice: string | undefined;
  try {
    const res = await partnerClient().request<ZoneRow[]>('GET', 'logistics/zones', { query: { activeOnly, pincode: pincode || undefined, cursor: searchParams.cursor } });
    rows = res.data ?? [];
    nextCursor = (res.meta?.nextCursor as string | undefined) ?? undefined;
  } catch { notice = t.t('dash.unavailable'); }

  const okCreated = searchParams.ok === 'created';
  const errKey = searchParams.error && ERR.has(searchParams.error) ? searchParams.error : null;
  const moreHref = () => {
    const p = new URLSearchParams();
    if (!activeOnly) p.set('active', 'false');
    if (pincode) p.set('pincode', pincode);
    if (nextCursor) p.set('cursor', nextCursor);
    return `/zones?${p.toString()}`;
  };

  const columns: Column<ZoneRow>[] = [
    { header: t.t('net.colName'), cell: (r) => <Link href={`/zones/${r.id}`}>{r.defaultName}</Link> },
    { header: t.t('net.colPincodes'), cell: (r) => String(r.pincodes.length) },
    { header: t.t('net.colRegions'), cell: (r) => String(r.regionIds.length) },
    { header: t.t('net.colActive'), cell: (r) => <span className={`kv-status kv-status--${r.isActive ? 'ok' : 'muted'}`}>{t.t(r.isActive ? 'common.active' : 'common.inactive')}</span> },
  ];

  return (
    <section>
      <h1>{t.t('net.zonesTitle')}</h1>
      <p className="kv-muted">{t.t('net.zonesLead')}</p>
      <NetworkNav active="zones" />
      {okCreated && <p className="kv-success" role="status">{t.t('net.ok.created')}</p>}
      {errKey && <p className="kv-error" role="alert">{t.t(`net.err.${errKey}`)}</p>}

      <form className="kv-filters" aria-label={t.t('net.filterPincode')}>
        <input name="pincode" className="kv-input" inputMode="numeric" defaultValue={pincode} placeholder={t.t('net.pincodeFilterHint')} aria-label={t.t('net.filterPincode')} />
        {!activeOnly && <input type="hidden" name="active" value="false" />}
        <button type="submit" className="kv-btn">{t.t('net.applyFilter')}</button>
      </form>
      <nav className="kv-filters" aria-label={t.t('common.filter')}>
        <Link href={`/zones${pincode ? `?pincode=${encodeURIComponent(pincode)}` : ''}`} className={`kv-chip${activeOnly ? ' is-active' : ''}`} aria-current={activeOnly ? 'true' : undefined}>{t.t('net.filterActive')}</Link>
        <Link href={`/zones?active=false${pincode ? `&pincode=${encodeURIComponent(pincode)}` : ''}`} className={`kv-chip${!activeOnly ? ' is-active' : ''}`} aria-current={!activeOnly ? 'true' : undefined}>{t.t('net.filterAll')}</Link>
      </nav>

      {notice ? <p className="kv-error" role="alert">{notice}</p> : (
        <>
          <DataTable columns={columns} rows={rows} empty={t.t('net.zonesEmpty')} />
          {nextCursor && <p className="kv-pager"><Link className="kv-btn" href={moreHref()}>{t.t('common.nextPage')}</Link></p>}
        </>
      )}

      <details className="kv-card kv-limit-form">
        <summary className="kv-card__title">{t.t('net.createZone')}</summary>
        <form action={createZoneAction} className="kv-form">
          <label htmlFor="z-name" className="kv-field__label">{t.t('net.zoneName')}</label>
          <input id="z-name" name="defaultName" className="kv-input" required maxLength={120} />
          <label htmlFor="z-pins" className="kv-field__label">{t.t('net.pincodes')}</label>
          <textarea id="z-pins" name="pincodes" className="kv-input" rows={3} placeholder={t.t('net.pincodesHint')} />
          <label htmlFor="z-regions" className="kv-field__label">{t.t('net.regionIds')}</label>
          <textarea id="z-regions" name="regionIds" className="kv-input" rows={2} placeholder={t.t('net.regionIdsHint')} />
          <label htmlFor="z-charge" className="kv-field__label">{t.t('net.chargeDefinitionId')}</label>
          <input id="z-charge" name="chargeDefinitionId" className="kv-input" placeholder={t.t('net.uuidHint')} />
          <button type="submit" className="kv-btn">{t.t('net.createZoneSubmit')}</button>
        </form>
      </details>
    </section>
  );
}
