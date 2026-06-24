// apps/web-partner/src/app/fleet/vehicles/page.tsx · the fleet's vehicles (GET logistics/vehicles). active-only
// toggle + create (POST, Idempotency-Key). capacityKg is a weight (not money). Degrade-never-die. All copy via
// i18n; no inline styles; noindex.
import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePartner } from '../../../lib/session';
import { partnerClient } from '../../../lib/api-client';
import { DataTable, Column } from '../../../components/DataTable';
import { getTranslator } from '../../../lib/i18n';
import { parseActiveOnly, type VehicleRow } from '../../../features/logistics/fleet';
import { createVehicleAction } from '../actions';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('fleet.vehiclesTitle'), robots: { index: false, follow: false } };
}

const ERR = new Set(['partnerId', 'regNo', 'capacity', 'forbidden', 'conflict', 'notFound', 'generic']);

export default async function VehiclesPage({ searchParams }: { searchParams: { active?: string; ok?: string; error?: string } }) {
  await requirePartner();
  const t = getTranslator();
  const activeOnly = parseActiveOnly(searchParams.active);

  let rows: VehicleRow[] = [];
  let notice: string | undefined;
  try {
    rows = (await partnerClient().request<VehicleRow[]>('GET', 'logistics/vehicles', { query: { activeOnly } })).data ?? [];
  } catch { notice = t.t('dash.unavailable'); }

  const okCreated = searchParams.ok === 'created';
  const errKey = searchParams.error && ERR.has(searchParams.error) ? searchParams.error : null;
  const columns: Column<VehicleRow>[] = [
    { header: t.t('fleet.colReg'), cell: (r) => <Link href={`/fleet/vehicles/${r.id}`}>{r.regNo}</Link> },
    { header: t.t('fleet.colCapacity'), cell: (r) => (r.capacityKg === null ? t.t('common.dash') : String(r.capacityKg)) },
    { header: t.t('fleet.colRefrigerated'), cell: (r) => t.t(r.isRefrigerated ? 'common.yes' : 'common.no') },
    { header: t.t('fleet.colActive'), cell: (r) => <span className={`kv-status kv-status--${r.isActive ? 'ok' : 'muted'}`}>{t.t(r.isActive ? 'common.active' : 'common.inactive')}</span> },
  ];

  return (
    <section>
      <h1>{t.t('fleet.vehiclesTitle')}</h1>
      <p className="kv-muted">{t.t('fleet.vehiclesLead')}</p>
      <nav className="kv-filters" aria-label={t.t('fleet.nav')}>
        <Link href="/fleet" className="kv-chip">{t.t('fleet.navCarriers')}</Link>
        <Link href="/fleet/vehicles" className="kv-chip is-active" aria-current="true">{t.t('fleet.navVehicles')}</Link>
        <Link href="/fleet/slots" className="kv-chip">{t.t('fleet.navSlots')}</Link>
      </nav>
      {okCreated && <p className="kv-success" role="status">{t.t('fleet.ok.created')}</p>}
      {errKey && <p className="kv-error" role="alert">{t.t(`fleet.err.${errKey}`)}</p>}

      <nav className="kv-filters" aria-label={t.t('common.filter')}>
        <Link href="/fleet/vehicles?active=true" className={`kv-chip${activeOnly ? ' is-active' : ''}`} aria-current={activeOnly ? 'true' : undefined}>{t.t('fleet.filterActive')}</Link>
        <Link href="/fleet/vehicles?active=false" className={`kv-chip${!activeOnly ? ' is-active' : ''}`} aria-current={!activeOnly ? 'true' : undefined}>{t.t('fleet.filterAll')}</Link>
      </nav>

      {notice ? <p className="kv-error" role="alert">{notice}</p> : <DataTable columns={columns} rows={rows} empty={t.t('fleet.vehiclesEmpty')} />}

      <details className="kv-card kv-limit-form">
        <summary className="kv-card__title">{t.t('fleet.createVehicle')}</summary>
        <form action={createVehicleAction} className="kv-form">
          <label htmlFor="partnerId" className="kv-field__label">{t.t('fleet.partnerId')}</label>
          <input id="partnerId" name="partnerId" className="kv-input" required placeholder={t.t('fleet.partnerIdHint')} />
          <label htmlFor="regNo" className="kv-field__label">{t.t('fleet.regNo')}</label>
          <input id="regNo" name="regNo" className="kv-input" required minLength={4} maxLength={24} placeholder={t.t('fleet.regNoHint')} />
          <label htmlFor="capacityKg" className="kv-field__label">{t.t('fleet.capacity')}</label>
          <input id="capacityKg" name="capacityKg" className="kv-input" inputMode="numeric" placeholder={t.t('fleet.capacityHint')} />
          <label className="kv-field__label"><input type="checkbox" name="isRefrigerated" value="true" /> {t.t('fleet.refrigeratedField')}</label>
          <button type="submit" className="kv-btn">{t.t('fleet.createVehicleSubmit')}</button>
        </form>
      </details>
    </section>
  );
}
