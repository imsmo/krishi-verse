// modules/fintech/controllers/v1/loans.controller.ts · loan servicing: repay + views. `fintech` flag.
// repay = borrower (loan.borrow), money route → Idempotency-Key (Law 3).
import { Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { LoanService } from '../../services/loan.service';
import { RepayLoanSchema, RepayLoanDto } from '../../dto/create-loan-repayment.dto';
import { QueryLoansSchema, QueryLoansDto } from '../../dto/query-loan.dto';
import { FintechPermissions, canBorrow, canManageLoans } from '../../policies/fintech.policies';

const ipOf = (r: Request) => r.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'fintech/loans', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('fintech')
export class LoansController {
  constructor(private readonly svc: LoanService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canBorrow: canBorrow(ctx), canManage: canManageLoans(ctx) }; }

  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryLoansSchema) q: QueryLoansDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), { box: q.box, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Get(':id/repayments')
  repayments(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.listRepayments(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/repay') @RequirePermissions(FintechPermissions.Borrow)
  repay(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @Headers('idempotency-key') key: string, @ZodBody(RepayLoanSchema) dto: RepayLoanDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.repay(ctx.tenantId, this.actor(ctx), id, key, dto, ipOf(r)).then((data) => ({ data }));
  }
}
