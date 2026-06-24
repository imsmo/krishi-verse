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

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };
const CCY = /^[A-Z]{3}$/;
const currencyOf = (raw?: string) => (raw && CCY.test(raw) ? raw : 'INR');

@Controller({ path: 'wallet', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class WalletController {
  constructor(
    private readonly balance: WalletBalanceReadModel,
    private readonly ledger: WalletLedgerReadModel,
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
}
