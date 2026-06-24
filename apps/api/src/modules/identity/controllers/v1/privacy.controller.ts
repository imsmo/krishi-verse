// modules/identity/controllers/v1/privacy.controller.ts · DPDP data-subject rights (export / deletion / status).
// All scoped to the CALLER's own userId (re-resolved from the token — no client id, zero IDOR). The platform is
// the data controller (Law 11): these endpoints only REGISTER a request; fulfilment is server-owned. No feature
// flag — exercising your DPDP rights is a core self-service. Requests are idempotent (Law 3).
import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { PrivacyService } from '../../services/privacy.service';

@Controller({ path: 'privacy', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}
  private key(k: string) { if (!k) throw new BadRequestError('Idempotency-Key header required'); return k; }

  @Post('export-requests')
  export(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string) {
    return this.privacy.requestExport(ctx.tenantId, ctx.userId, this.key(key)).then((data) => ({ data }));
  }
  @Post('deletion-requests')
  deletion(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @Body('reason') _reason?: string) {
    return this.privacy.requestDeletion(ctx.tenantId, ctx.userId, this.key(key)).then((data) => ({ data }));
  }
  @Get('requests')
  mine(@CurrentContext() ctx: RequestContext) {
    return this.privacy.listMine(ctx.tenantId, ctx.userId).then((res) => ({ data: res.items }));
  }
}
