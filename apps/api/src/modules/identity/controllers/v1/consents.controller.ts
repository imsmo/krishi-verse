// modules/identity/controllers/v1/consents.controller.ts · DPDP consent capture (append-only).
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { ConsentService } from '../../services/consent.service';
import { GrantConsentSchema, GrantConsentDto } from '../../dto/grant-consent.dto';

@Controller({ path: 'consents', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class ConsentsController {
  constructor(private readonly consents: ConsentService) {}
  @Get() list(@CurrentContext() ctx: RequestContext) { return this.consents.list(ctx.tenantId, ctx.userId).then((data) => ({ data })); }
  @Post() grant(@CurrentContext() ctx: RequestContext, @ZodBody(GrantConsentSchema) dto: GrantConsentDto) { return this.consents.grant(ctx.tenantId, ctx.userId, dto).then((data) => ({ data })); }
}
