// modules/catalogue/controllers/v1/certificates.controller.ts · submit a certificate (idempotent), the moderator
// verify/reject decision, list a tenant's certs, and resolve the regulated-input rules for a product/category.
// validate → authorize → delegate ONLY. Submit needs certificate.submit; the decision needs certificate.verify
// (moderation); reads need an authed tenant context. Tenant-scoped throughout (RLS + 404 on non-member).
import { Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { CertificateService } from '../../services/certificate.service';
import { RegulatedRuleService } from '../../services/regulated-rule.service';
import { CreateCertificateSchema, CreateCertificateDto, DecideCertificateSchema, DecideCertificateDto } from '../../dto/create-certificate.dto';
import { QueryCertificateSchema, QueryCertificateDto, QueryRegulatedRuleSchema, QueryRegulatedRuleDto } from '../../dto/query-certificate.dto';
import { CataloguePermissions } from '../../policies/catalogue.policies';

const ipOf = (req: Request) => req.ip || null;

@Controller({ path: 'certificates', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class CertificatesController {
  constructor(private readonly certs: CertificateService, private readonly rules: RegulatedRuleService) {}

  @Get() @RequirePermissions(CataloguePermissions.CertSubmit)
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryCertificateSchema) q: QueryCertificateDto) {
    return this.certs.list(ctx.tenantId, q).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  // regulated-input rules resolver (read) — used by listing-create compliance checks. Declared before :id.
  @Get('regulated-rules') @RequirePermissions(CataloguePermissions.CertSubmit)
  regulatedRules(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryRegulatedRuleSchema) q: QueryRegulatedRuleDto) {
    return this.rules.resolve(ctx.tenantId, q).then((data) => ({ data }));
  }

  @Get(':id') @RequirePermissions(CataloguePermissions.CertSubmit)
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    return this.certs.getById(ctx.tenantId, id).then((data) => ({ data }));
  }

  @Post() @RequirePermissions(CataloguePermissions.CertSubmit)
  async submit(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateCertificateSchema) dto: CreateCertificateDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return { data: await this.certs.submit(ctx.tenantId, ctx.userId, key, dto) };
  }

  @Post(':id/decision') @RequirePermissions(CataloguePermissions.CertVerify)
  async decide(@CurrentContext() ctx: RequestContext, @Req() req: Request, @Param('id') id: string, @ZodBody(DecideCertificateSchema) dto: DecideCertificateDto) {
    return { data: await this.certs.decide(ctx.tenantId, ctx.userId, id, dto, ipOf(req)) };
  }
}
