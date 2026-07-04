// modules/payments/read-models/wallet-statement.ts
// PURE formatters for the P0-3 wallet STATEMENT export (CSV + PDF text lines). No I/O, no DB — takes the rows the
// ledger read-model already fetched and turns them into a downloadable artifact. Money stays bigint minor units
// end-to-end (Law 2): amounts are formatted to a human decimal ONLY for display, computed by integer arithmetic
// (no floats). CSV is RFC-4180-quoted so a description containing a comma/quote/newline can never break a column.
import type { WalletLedgerEntryView } from './wallet-ledger.read-model';

/** Integer minor→major with 2 fraction digits, sign-preserving. e.g. "-12345" → "-123.45". Float-free. */
export function formatMinorPlain(minor: string, fractionDigits = 2): string {
  let neg = false;
  let s = (minor ?? '0').trim();
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  if (!/^\d+$/.test(s)) return '0';
  const pad = s.padStart(fractionDigits + 1, '0');
  const whole = pad.slice(0, pad.length - fractionDigits) || '0';
  const frac = fractionDigits > 0 ? '.' + pad.slice(pad.length - fractionDigits) : '';
  return `${neg ? '-' : ''}${whole}${frac}`;
}

/** RFC-4180 field quoting: wrap in quotes + double internal quotes when the value has a comma/quote/CR/LF. */
export function csvField(v: string | null | undefined): string {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADERS = ['Date', 'Type', 'Account', 'Amount', 'BalanceAfter', 'Currency', 'Reference', 'Description'];

/** The whole statement as a CSV string (header + one row per ledger entry). Amounts are decimal-formatted. */
export function toCsv(rows: readonly WalletLedgerEntryView[]): string {
  const lines = [HEADERS.join(',')];
  for (const r of rows) {
    lines.push([
      csvField(r.createdAt),
      csvField(r.txnType ?? ''),
      csvField(r.accountCode),
      csvField(formatMinorPlain(r.amountMinor)),
      csvField(formatMinorPlain(r.balanceAfterMinor)),
      csvField(r.currencyCode),
      csvField(r.referenceType ? `${r.referenceType}:${r.referenceId ?? ''}` : ''),
      csvField(r.description ?? ''),
    ].join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

/** The statement as PDF text lines (fed to renderTextPdf). A compact fixed-order ledger with a signed amount and
 *  running balance per row; totals credited/debited computed float-free by bigint accumulation. */
export function statementPdfLines(rows: readonly WalletLedgerEntryView[], meta: { fromIso: string; toIso: string; currencyCode: string }): string[] {
  let credited = 0n, debited = 0n;
  const body = rows.map((r) => {
    let amt = 0n;
    try { amt = BigInt(r.amountMinor); } catch { amt = 0n; }
    if (amt >= 0n) credited += amt; else debited += -amt;
    const date = r.createdAt.slice(0, 10);
    const sign = amt >= 0n ? '+' : '-';
    const mag = formatMinorPlain((amt < 0n ? -amt : amt).toString());
    return `${date}  ${(r.txnType ?? '—').padEnd(18).slice(0, 18)} ${sign}${mag.padStart(12)}  bal ${formatMinorPlain(r.balanceAfterMinor).padStart(12)}`;
  });
  return [
    `Period : ${meta.fromIso.slice(0, 10)} to ${meta.toIso.slice(0, 10)}`,
    `Currency: ${meta.currencyCode}`,
    `Entries : ${rows.length}`,
    '',
    ...(body.length ? body : ['(no wallet activity in this period)']),
    '',
    `Total credited : ${meta.currencyCode} ${formatMinorPlain(credited.toString())}`,
    `Total debited  : ${meta.currencyCode} ${formatMinorPlain(debited.toString())}`,
    '',
    'This is a computer-generated statement.',
  ];
}
