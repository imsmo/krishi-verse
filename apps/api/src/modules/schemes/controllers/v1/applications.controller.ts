// modules/schemes/controllers/v1/applications.controller.ts · scheme application lifecycle + DBT records. `schemes` flag.
// apply/submit/resubmit/appeal = applicant (scheme.apply); verify/clarify/approve/reject/close + DBT record
// = officer (scheme.process). Money route (submit, collects the processing fee) requires an Idempotency-Key.
import { Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { SchemeApplicationService } from '../../services/scheme-application.service';
import { DbtTransferService } from '../../services/dbt-transfer.service';
import { ApplySchemeSchema, ApplySchemeDto, ClarifySchema, ClarifyDto, ApproveSchema, ApproveDto, RejectSchema, RejectDto } from '../../dto/create-scheme-application.dto';
import { QueryApplicationsSchema, QueryApplicationsDto } from '../../dto/query-scheme-application.dto';
import { RecordDbtSchema, RecordDbtDto } from '../../dto/create-dbt-transfer.dto';
import { SchemesPermissions, canApply, canProcess } from '../../policies/schemes.policies';

const ipOf = (r: Request) => r.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'schemes/applications', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('schemes')
export class ApplicationsController {
  constructor(private readonly svc: SchemeApplicationService, private readonly dbt: DbtTransferService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canApply: canApply(ctx), canProcess: canProcess(ctx) }; }

  @Post() @RequirePermissions(SchemesPermissions.Apply)
  apply(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(ApplySchemeSchema) dto: ApplySchemeDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.apply(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryApplicationsSchema) q: QueryApplicationsDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), { box: q.box, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  @Post(':id/submit') @RequirePermissions(SchemesPermissions.Apply)
  submit(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Headers('idempotency-key') key: string) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.submit(ctx.tenantId, this.actor(ctx), id, key).then((data) => ({ data }));
  }
  @Post(':id/resubmit') @RequirePermissions(SchemesPermissions.Apply)
  resubmit(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.resubmit(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/appeal') @RequirePermissions(SchemesPermissions.Apply)
  appeal(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.appeal(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  @Post(':id/verify') @RequirePermissions(SchemesPermissions.Process)
  verify(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.startVerification(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Post(':id/clarify') @RequirePermissions(SchemesPermissions.Process)
  clarify(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(ClarifySchema) dto: ClarifyDto) { return this.svc.requestClarification(ctx.tenantId, this.actor(ctx), id, dto).then((data) => ({ data })); }
  @Post(':id/approve') @RequirePermissions(SchemesPermissions.Process)
  approve(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @ZodBody(ApproveSchema) dto: ApproveDto) { return this.svc.approve(ctx.tenantId, this.actor(ctx), id, dto, ipOf(r)).then((data) => ({ data })); }
  @Post(':id/reject') @RequirePermissions(SchemesPermissions.Process)
  reject(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @ZodBody(RejectSchema) dto: RejectDto) { return this.svc.reject(ctx.tenantId, this.actor(ctx), id, dto, ipOf(r)).then((data) => ({ data })); }
  @Post(':id/close') @RequirePermissions(SchemesPermissions.Process)
  close(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.close(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }

  // DBT (observed PFMS credit) — officer records; applicant/officer reads
  @Post(':id/dbt') @RequirePermissions(SchemesPermissions.Process)
  recordDbt(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @ZodBody(RecordDbtSchema) dto: RecordDbtDto) { return this.dbt.record(ctx.tenantId, this.actor(ctx), id, dto, ipOf(r)).then((data) => ({ data })); }
  @Get(':id/dbt')
  listDbt(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.dbt.listForApplication(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
}
