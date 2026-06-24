// apps/web-partner/src/app/profile/page.tsx · the platform lender registry (GET fintech/partners). Read-only; the
// financial partners registered on the platform (banks/NBFCs/MFIs/insurers/…), including this institution. kind +
// activeOnly filters mirror the controller (no keyset). Degrade-never-die. All copy via i18n; no inline styles;
// noindex.
import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePartner } from '../../lib/session';
import { partnerClient } from '../../lib/api-client';
import { DataTable, Column } from '../../components/DataTable';
import { getTranslator } from '../../lib/i18n';
import { PARTNER_KINDS, isPartnerKind, partnerKindKey, parseActiveOnly, type PartnerRow } from '../../features/lending/product';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('lender.title'), robots: { index: false, follow: false } };
}

export default async function LenderRegistryPage({ searchParams }: { searchParams: { kind?: string; active?: string } }) {
  await requirePartner();
  const t = getTranslator();
  const partnerKind = isPartnerKind(searchParams.kind) ? searchParams.kind : undefined;
  const activeOnly = parseActiveOnly(searchParams.active);

  let rows: PartnerRow[] = [];
  let notice: string | undefined;
  try {
    rows = (await partnerClient().request<PartnerRow[]>('GET', 'fintech/partners', { query: { partnerKind, activeOnly } })).data ?? [];
  } catch { notice = t.t('dash.unavailable'); }

  const columns: Column<PartnerRow>[] = [
    { header: t.t('lender.colName'), cell: (r) => <Link href={`/profile/${r.id}`}>{r.name}</Link> },
    { header: t.t('lender.colKind'), cell: (r) => t.t(partnerKindKey(r.partnerKind)) },
    { header: t.t('lender.colRegulator'), cell: (r) => r.regulatorRef ?? t.t('common.dash') },
    { header: t.t('lender.colActive'), cell: (r) => <span className={`kv-status kv-status--${r.isActive ? 'ok' : 'muted'}`}>{t.t(r.isActive ? 'common.active' : 'common.inactive')}</span> },
  ];
  const kindHref = (k?: string) => `/profile?${new URLSearchParams({ ...(k ? { kind: k } : {}), active: String(activeOnly) }).toString()}`;

  return (
    <section>
      <h1>{t.t('lender.title')}</h1>
      <p className="kv-muted">{t.t('lender.lead')}</p>
      <nav className="kv-filters" aria-label={t.t('lender.colKind')}>
        <Link href={kindHref()} className={`kv-chip${!partnerKind ? ' is-active' : ''}`} aria-current={!partnerKind ? 'true' : undefined}>{t.t('lender.filterAllKinds')}</Link>
        {PARTNER_KINDS.map((k) => (
          <Link key={k} href={kindHref(k)} className={`kv-chip${partnerKind === k ? ' is-active' : ''}`} aria-current={partnerKind === k ? 'true' : undefined}>{t.t(partnerKindKey(k))}</Link>
        ))}
      </nav>
      {notice ? <p className="kv-error" role="alert">{notice}</p> : <DataTable columns={columns} rows={rows} empty={t.t('lender.empty')} />}
    </section>
  );
}
