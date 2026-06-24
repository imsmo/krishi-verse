// apps/web-partner/src/app/fleet/page.tsx · 3PL carrier registry (GET logistics/partners). Server-gated; the API
// scopes to this partner (RLS). active-only toggle + create (POST, Idempotency-Key). Section nav over carriers /
// vehicles / pickup slots. Degrade-never-die. All copy via i18n; no inline styles; noindex.
import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePartner } from '../../lib/session';
import { partnerClient } from '../../lib/api-client';
import { DataTable, Column } from '../../components/DataTable';
import { getTranslator } from '../../lib/i18n';
import { PARTNER_KINDS, partnerKindKey, parseActiveOnly, type PartnerRow } from '../../features/logistics/fleet';
import { createPartnerAction } from './actions';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('fleet.carriersTitle'), robots: { index: false, follow: false } };
}

const ERR = new Set(['partnerKind', 'name', 'providerCode', 'forbidden', 'conflict', 'notFound', 'generic']);

export default async function FleetCarriersPage({ searchParams }: { searchParams: { active?: string; ok?: string; error?: string } }) {
  await requirePartner();
  const t = getTranslator();
  const activeOnly = parseActiveOnly(searchParams.active);

  let rows: PartnerRow[] = [];
  let notice: string | undefined;
  try {
    rows = (await partnerClient().request<PartnerRow[]>('GET', 'logistics/partners', { query: { activeOnly, includePlatform: false } })).data ?? [];
  } catch { notice = t.t('dash.unavailable'); }

  const okCreated = searchParams.ok === 'created';
  const errKey = searchParams.error && ERR.has(searchParams.error) ? searchParams.error : null;
  const columns: Column<PartnerRow>[] = [
    { header: t.t('fleet.colName'), cell: (r) => <Link href={`/fleet/carriers/${r.id}`}>{r.defaultName}</Link> },
    { header: t.t('fleet.colKind'), cell: (r) => t.t(partnerKindKey(r.partnerKind)) },
    { header: t.t('fleet.colProvider'), cell: (r) => r.providerCode ?? t.t('common.dash') },
    { header: t.t('fleet.colColdChain'), cell: (r) => t.t(r.supportsColdChain ? 'common.yes' : 'common.no') },
    { header: t.t('fleet.colActive'), cell: (r) => <span className={`kv-status kv-status--${r.isActive ? 'ok' : 'muted'}`}>{t.t(r.isActive ? 'common.active' : 'common.inactive')}</span> },
  ];

  return (
    <section>
      <h1>{t.t('fleet.carriersTitle')}</h1>
      <p className="kv-muted">{t.t('fleet.carriersLead')}</p>
      <nav className="kv-filters" aria-label={t.t('fleet.nav')}>
        <Link href="/fleet" className="kv-chip is-active" aria-current="true">{t.t('fleet.navCarriers')}</Link>
        <Link href="/fleet/vehicles" className="kv-chip">{t.t('fleet.navVehicles')}</Link>
        <Link href="/fleet/slots" className="kv-chip">{t.t('fleet.navSlots')}</Link>
      </nav>
      {okCreated && <p className="kv-success" role="status">{t.t('fleet.ok.created')}</p>}
      {errKey && <p className="kv-error" role="alert">{t.t(`fleet.err.${errKey}`)}</p>}

      <nav className="kv-filters" aria-label={t.t('common.filter')}>
        <Link href="/fleet?active=true" className={`kv-chip${activeOnly ? ' is-active' : ''}`} aria-current={activeOnly ? 'true' : undefined}>{t.t('fleet.filterActive')}</Link>
        <Link href="/fleet?active=false" className={`kv-chip${!activeOnly ? ' is-active' : ''}`} aria-current={!activeOnly ? 'true' : undefined}>{t.t('fleet.filterAll')}</Link>
      </nav>

      {notice ? <p className="kv-error" role="alert">{notice}</p> : <DataTable columns={columns} rows={rows} empty={t.t('fleet.carriersEmpty')} />}

      <details className="kv-card kv-limit-form">
        <summary className="kv-card__title">{t.t('fleet.createCarrier')}</summary>
        <form action={createPartnerAction} className="kv-form">
          <label htmlFor="partnerKind" className="kv-field__label">{t.t('fleet.kind')}</label>
          <select id="partnerKind" name="partnerKind" className="kv-input" defaultValue="3pl">{PARTNER_KINDS.map((k) => <option key={k} value={k}>{t.t(partnerKindKey(k))}</option>)}</select>
          <label htmlFor="defaultName" className="kv-field__label">{t.t('fleet.name')}</label>
          <input id="defaultName" name="defaultName" className="kv-input" required maxLength={150} />
          <label htmlFor="providerCode" className="kv-field__label">{t.t('fleet.providerCode')}</label>
          <input id="providerCode" name="providerCode" className="kv-input" placeholder={t.t('fleet.providerHint')} />
          <label className="kv-field__label"><input type="checkbox" name="supportsColdChain" value="true" /> {t.t('fleet.coldChainField')}</label>
          <button type="submit" className="kv-btn">{t.t('fleet.createCarrierSubmit')}</button>
        </form>
      </details>
    </section>
  );
}
