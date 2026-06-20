// modules/fintech/controllers/v1/loan-applications.controller.ts · loan origination. `fintech` flag.
// apply/withdraw = borrower (loan.borrow); review/approve/reject/disburse = lender (loan.manage). Money
// routes (apply, disburse) require an Idempotency-Key (Law 3).
import { Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { LoanApplicationService } from '../../services/loan-application.service';
import { ApplyLoanSchema, ApplyLoanDto, ApproveLoanSchema, ApproveLoanDto, RejectLoanSchema, RejectLoanDto } from '../../dto/create-loan-application.dto';
import { QueryApplicationsSchema, QueryApplicationsDto } from '../../dto/query-loan-application.dto';
import { FintechPermissions, canBorrow, canManageLoans } from '../../policies/fintech.policies';

const ipOf = (r: Request) => r.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'fintech/loan-applications', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('fintech')
export class LoanApplicationsController {
  constructor(private readonly svc: LoanApplicationService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canBorrow: canBorrow(ctx), canManage: canManageLoans(ctx) }; }

  @Post() @RequirePermissions(FintechPermissions.Borrow)
  apply(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(ApplyLoanSchema) dto: ApplyLoanDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.apply(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryApplicationsSchema) q: QueryApplicationsDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), { box: q.box, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/withdraw') @RequirePermissions(FintechPermissions.Borrow)
  withdraw(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.withdraw(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/review') @RequirePermissions(FintechPermissions.Manage)
  review(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.review(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/approve') @RequirePermissions(FintechPermissions.Manage)
  approve(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @ZodBody(ApproveLoanSchema) dto: ApproveLoanDto) { return this.svc.approve(ctx.tenantId, this.actor(ctx), id, dto, ipOf(r)).then((data) => ({ data })); }
  @Post(':id/reject') @RequirePermissions(FintechPermissions.Manage)
  reject(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @ZodBody(RejectLoanSchema) dto: RejectLoanDto) { return this.svc.reject(ctx.tenantId, this.actor(ctx), id, dto, ipOf(r)).then((data) => ({ data })); }
  @Post(':id/disburse') @RequirePermissions(FintechPermissions.Manage)
  disburse(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @Headers('idempotency-key') key: string) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.disburse(ctx.tenantId, this.actor(ctx), id, key, ipOf(r)).then((data) => ({ data }));
  }
}
