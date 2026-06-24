// apps/web-partner/src/app/fleet/slots/page.tsx · the seller's weekly pickup slots (GET logistics/pickup-slots).
// active-only toggle + create (POST, Idempotency-Key; start<end enforced by the pure builder). Degrade-never-die.
// All copy via i18n; no inline styles; noindex.
import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePartner } from '../../../lib/session';
import { partnerClient } from '../../../lib/api-client';
import { DataTable, Column } from '../../../components/DataTable';
import { getTranslator } from '../../../lib/i18n';
import { WEEKDAYS, weekdayKey, parseActiveOnly, type SlotRow } from '../../../features/logistics/fleet';
import { createSlotAction } from '../actions';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('fleet.slotsTitle'), robots: { index: false, follow: false } };
}

const ERR = new Set(['weekday', 'startTime', 'endTime', 'timeOrder', 'forbidden', 'conflict', 'notFound', 'generic']);

export default async function SlotsPage({ searchParams }: { searchParams: { active?: string; ok?: string; error?: string } }) {
  await requirePartner();
  const t = getTranslator();
  const activeOnly = parseActiveOnly(searchParams.active);

  let rows: SlotRow[] = [];
  let notice: string | undefined;
  try {
    rows = (await partnerClient().request<SlotRow[]>('GET', 'logistics/pickup-slots', { query: { activeOnly } })).data ?? [];
  } catch { notice = t.t('dash.unavailable'); }

  const okCreated = searchParams.ok === 'created';
  const errKey = searchParams.error && ERR.has(searchParams.error) ? searchParams.error : null;
  const columns: Column<SlotRow>[] = [
    { header: t.t('fleet.colWeekday'), cell: (r) => <Link href={`/fleet/slots/${r.id}`}>{t.t(weekdayKey(r.weekday))}</Link> },
    { header: t.t('fleet.colWindow'), cell: (r) => `${r.startTime} – ${r.endTime}` },
    { header: t.t('fleet.colActive'), cell: (r) => <span className={`kv-status kv-status--${r.isActive ? 'ok' : 'muted'}`}>{t.t(r.isActive ? 'common.active' : 'common.inactive')}</span> },
  ];

  return (
    <section>
      <h1>{t.t('fleet.slotsTitle')}</h1>
      <p className="kv-muted">{t.t('fleet.slotsLead')}</p>
      <nav className="kv-filters" aria-label={t.t('fleet.nav')}>
        <Link href="/fleet" className="kv-chip">{t.t('fleet.navCarriers')}</Link>
        <Link href="/fleet/vehicles" className="kv-chip">{t.t('fleet.navVehicles')}</Link>
        <Link href="/fleet/slots" className="kv-chip is-active" aria-current="true">{t.t('fleet.navSlots')}</Link>
      </nav>
      {okCreated && <p className="kv-success" role="status">{t.t('fleet.ok.created')}</p>}
      {errKey && <p className="kv-error" role="alert">{t.t(`fleet.err.${errKey}`)}</p>}

      <nav className="kv-filters" aria-label={t.t('common.filter')}>
        <Link href="/fleet/slots?active=true" className={`kv-chip${activeOnly ? ' is-active' : ''}`} aria-current={activeOnly ? 'true' : undefined}>{t.t('fleet.filterActive')}</Link>
        <Link href="/fleet/slots?active=false" className={`kv-chip${!activeOnly ? ' is-active' : ''}`} aria-current={!activeOnly ? 'true' : undefined}>{t.t('fleet.filterAll')}</Link>
      </nav>

      {notice ? <p className="kv-error" role="alert">{notice}</p> : <DataTable columns={columns} rows={rows} empty={t.t('fleet.slotsEmpty')} />}

      <details className="kv-card kv-limit-form">
        <summary className="kv-card__title">{t.t('fleet.createSlot')}</summary>
        <form action={createSlotAction} className="kv-form">
          <label htmlFor="weekday" className="kv-field__label">{t.t('fleet.weekday')}</label>
          <select id="weekday" name="weekday" className="kv-input" defaultValue="1">{WEEKDAYS.map((d) => <option key={d} value={d}>{t.t(weekdayKey(d))}</option>)}</select>
          <label htmlFor="startTime" className="kv-field__label">{t.t('fleet.startTime')}</label>
          <input id="startTime" name="startTime" className="kv-input" type="time" required />
          <label htmlFor="endTime" className="kv-field__label">{t.t('fleet.endTime')}</label>
          <input id="endTime" name="endTime" className="kv-input" type="time" required />
          <button type="submit" className="kv-btn">{t.t('fleet.createSlotSubmit')}</button>
        </form>
      </details>
    </section>
  );
}
