// apps/web-tenant/src/app/wallet/page.tsx · the tenant's settlements / payments ledger. Server-first,
// requireSession-gated. Read-only: payments.list (keyset) shows money-IN (settlements, recharges, captures) with
// status/purpose/amount/date. Money via formatMoneyMinor (Law 2). Degrades to an empty/error state; noindex.
//
// SDK-GAP (flagged, not faked): the seller SDK exposes NO wallet-balance / ledger-summary read (only payments +
// payouts lists). So a running balance is intentionally NOT shown — we ship the payments ledger only and note the
// gap, rather than computing a fake balance from a partial page. Unblocked when sdk-js adds a wallet.balance read.
import type { Metadata } from 'next';
import { requireSession } from '../../lib/session';
import { tenantClient } from '../../lib/api-client';
import { DataTable } from '../../components/DataTable';
import { getTranslator, getLang } from '../../lib/i18n';
import { formatMoneyMinor, formatDate } from '@krishi-verse/i18n';
import type { PaymentSummary } from '@krishi-verse/sdk-js';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return { title: getTranslator().t('wallet.title'), robots: { index: false, follow: false } };
}

export default async function WalletPage({ searchParams }: { searchParams: { cursor?: string } }) {
  await requireSession('/wallet');
  const t = getTranslator();
  const lang = getLang();

  let items: PaymentSummary[] = []; let nextCursor: string | null = null; let failed = false;
  try { const p = await tenantClient().payments.list(searchParams.cursor, 50); items = p.items; nextCursor = p.nextCursor; }
  catch { failed = true; }

  return (
    <section>
      <h1>{t.t('wallet.title')}</h1>
      <p className="kv-muted">{t.t('wallet.intro')}</p>
      {failed ? <p className="kv-error" role="alert">{t.t('wallet.loadError')}</p> : (
        <DataTable
          rows={items}
          empty={t.t('wallet.empty')}
          columns={[
            { header: t.t('wallet.colAmount'), cell: (p) => formatMoneyMinor(p.amountMinor, p.currencyCode, lang) },
            { header: t.t('wallet.colStatus'), cell: (p) => <span className="kv-badge">{p.status}</span> },
            { header: t.t('wallet.colPurpose'), cell: (p) => p.purpose ?? t.t('common.dash') },
            { header: t.t('wallet.colDate'), cell: (p) => (p.createdAt ? formatDate(p.createdAt, lang) : t.t('common.dash')) },
          ]}
        />
      )}
      {nextCursor && <p className="kv-pager"><a href={`/wallet?cursor=${encodeURIComponent(nextCursor)}`} className="kv-btn--link">{t.t('common.nextPage')}</a></p>}
      <p className="kv-field__hint kv-note">{t.t('wallet.balanceUnavailable')}</p>
    </section>
  );
}
