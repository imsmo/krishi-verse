// modules/identity/controllers/v1/kyc.controller.ts · KYC submission (self) + review (admin).
import { Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../../core/idempotency/idempotency.service';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { KycDocumentService } from '../../services/kyc-document.service';
import { EkycService } from '../../services/ekyc.service';
import { SubmitKycSchema, SubmitKycDto, ReviewKycSchema, ReviewKycDto } from '../../dto/create-kyc-document.dto';
import { StartEkycSchema, StartEkycDto, VerifyEkycSchema, VerifyEkycDto } from '../../dto/ekyc.dto';
import { IdentityPermissions } from '../../policies/identity.policies';

const ipOf = (req: Request) => (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;

@Controller({ path: 'kyc', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('kyc')
export class KycController {
  constructor(private readonly kyc: KycDocumentService, private readonly ekyc: EkycService, @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService) {}

  // --- eKYC (Aadhaar/PAN provider verification). Static paths declared BEFORE the bare @Get()/`:id`. ---
  // The RAW id is accepted in the body, validated, sent to the provider, then discarded — only masked + ref persist.
  @Post('ekyc/start')
  async ekycStart(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(StartEkycSchema) dto: StartEkycDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    const data = await this.idem.remember(key, ctx.userId, 'identity.ekyc.start', () => this.ekyc.start(ctx.tenantId, ctx.userId, dto));
    return { data };
  }

  @Post('ekyc/verify')
  async ekycVerify(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(VerifyEkycSchema) dto: VerifyEkycDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    const data = await this.idem.remember(key, ctx.userId, 'identity.ekyc.verify', () => this.ekyc.verify(ctx.tenantId, ctx.userId, dto));
    return { data };
  }

  @Get('ekyc/sessions')
  ekycSessions(@CurrentContext() ctx: RequestContext) {
    return this.ekyc.list(ctx.tenantId, ctx.userId, { limit: 20 }).then((data) => ({ data }));
  }

  @Post()
  async submit(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(SubmitKycSchema) dto: SubmitKycDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    const data = await this.idem.remember(key, ctx.userId, 'identity.kyc.submit', () => this.kyc.submit(ctx.tenantId, ctx.userId, dto));
    return { data };
  }

  // Static path declared BEFORE the bare @Get() so the catalogue route is unambiguous. Self-read of a
  // seeded vocabulary (no PII, no subject ids) — inherits AuthGuard + the 'kyc' flag from the controller.
  @Get('doc-types')
  docTypes(@CurrentContext() ctx: RequestContext) {
    return this.kyc.listDocTypes(ctx.tenantId).then((data) => ({ data }));
  }

  @Get()
  list(@CurrentContext() ctx: RequestContext, @Query('status') status?: string) {
    return this.kyc.list(ctx.tenantId, ctx.userId, status).then((data) => ({ data }));
  }

  @Post(':id/review')
  @RequirePermissions(IdentityPermissions.Approve)
  async review(@CurrentContext() ctx: RequestContext, @Req() req: Request, @Param('id') id: string, @ZodBody(ReviewKycSchema) dto: ReviewKycDto) {
    return { data: await this.kyc.review(ctx.tenantId, ctx.userId, id, dto, ipOf(req)) };
  }
}
