// modules/payments/controllers/v1/wallet.controller.ts · the caller's OWN wallet read-model (balance + ledger).
// Read-only CQRS projection of the wallet-service double-entry ledger (Law 2/11 — this never moves money). Both
// endpoints are ALWAYS the authenticated caller's own wallet (no userId param) → zero IDOR surface; the read-models
// additionally fail-closed. NOT behind the online_payments flag: viewing your own balance is a core read, not a
// toggleable feature (a user must see their money even when online top-up is disabled). Served from the replica.
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { WalletBalanceReadModel } from '../../read-models/wallet-balance.read-model';
import { WalletLedgerReadModel } from '../../read-models/wallet-ledger.read-model';
import { WalletInsightsReadModel } from '../../read-models/wallet-insights.read-model';
import { SavedInstrumentsReadModel } from '../../read-models/saved-instruments.read-model';
import { resolveWindow } from '../../read-models/insights-window';
import { toCsv, statementPdfLines } from '../../read-models/wallet-statement';
import { renderTextPdf } from '../../../../core/media/pdf/pdf-writer';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };
const CCY = /^[A-Z]{3}$/;
const currencyOf = (raw?: string) => (raw && CCY.test(raw) ? raw : 'INR');

@Controller({ path: 'wallet', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class WalletController {
  constructor(
    private readonly balance: WalletBalanceReadModel,
    private readonly ledger: WalletLedgerReadModel,
    private readonly insights: WalletInsightsReadModel,
    private readonly instruments: SavedInstrumentsReadModel,
  ) {}

  /** The caller's reconciled wallet balance (available + held), server-truth, bigint minor units. */
  @Get('balance')
  getBalance(@CurrentContext() ctx: RequestContext, @Query('currency') currency?: string) {
    return this.balance.forUser(ctx.userId, ctx.userId, false, currencyOf(currency)).then((data) => ({ data }));
  }

  /** The caller's wallet ledger (per-entry statement), keyset-paginated. */
  @Get('ledger')
  getLedger(@CurrentContext() ctx: RequestContext, @Query('cursor') cursor?: string, @Query('limit') limit?: string, @Query('currency') currency?: string) {
    const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return this.ledger.forUser(ctx.userId, ctx.userId, false, { cursor: decodeCursor(cursor), limit: lim, currencyCode: currencyOf(currency) })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  /** The caller's OWN earnings (credits to their wallet) aggregated by month + txn type over a bounded window.
   *  `groupBy=crop` (P0-3) additionally returns `byCrop` — earnings attributed to each order's product title. */
  @Get('earnings')
  getEarnings(@CurrentContext() ctx: RequestContext, @Query('from') from?: string, @Query('to') to?: string, @Query('currency') currency?: string, @Query('groupBy') groupBy?: string) {
    return this.insights.earnings(ctx.userId, ctx.userId, false, { from, to, currencyCode: currencyOf(currency), groupBy: groupBy === 'crop' ? 'crop' : undefined }).then((data) => ({ data }));
  }

  /** P0-3 statement export: the caller's OWN wallet ledger for a bounded window as a downloadable CSV or PDF.
   *  Returns the file INLINE (base64 for pdf / utf8 for csv) with a suggested filename + content type — no S3,
   *  no `@Res` coupling; the client writes/shares the bytes. Money stays bigint minor units (Law 2). */
  @Get('statement')
  async getStatement(
    @CurrentContext() ctx: RequestContext,
    @Query('format') format?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('currency') currency?: string,
  ) {
    const fmt = format === 'pdf' ? 'pdf' : 'csv';
    const currencyCode = currencyOf(currency);
    const win = resolveWindow(from, to);
    const rows = await this.ledger.statementRows(ctx.userId, ctx.userId, false, { fromIso: win.fromIso, toIso: win.toIso, currencyCode });
    const stamp = `${win.fromIso.slice(0, 10)}_${win.toIso.slice(0, 10)}`;
    if (fmt === 'pdf') {
      const bytes = renderTextPdf(`Wallet Statement`, statementPdfLines(rows, { fromIso: win.fromIso, toIso: win.toIso, currencyCode }));
      return { data: { filename: `wallet-statement_${stamp}.pdf`, contentType: 'application/pdf', encoding: 'base64', content: bytes.toString('base64'), rowCount: rows.length } };
    }
    const csv = toCsv(rows);
    return { data: { filename: `wallet-statement_${stamp}.csv`, contentType: 'text/csv', encoding: 'utf8', content: csv, rowCount: rows.length } };
  }

  /** The caller's OWN saved payment instruments (P0-4): live UPI-AutoPay mandates (masked handle) + tokenised
   *  bank/UPI payout instruments (last-4 / IFSC only). Nothing sensitive is returned; a core read (no flag). */
  @Get('instruments')
  getInstruments(@CurrentContext() ctx: RequestContext) {
    return this.instruments.forUser(ctx.tenantId, ctx.userId).then((data) => ({ data }));
  }

  /** The caller's OWN spending (debits from their wallet) aggregated by month + txn type over a bounded window. */
  @Get('spending-insights')
  getSpending(@CurrentContext() ctx: RequestContext, @Query('from') from?: string, @Query('to') to?: string, @Query('currency') currency?: string) {
    return this.insights.spending(ctx.userId, ctx.userId, false, { from, to, currencyCode: currencyOf(currency) }).then((data) => ({ data }));
  }
}
