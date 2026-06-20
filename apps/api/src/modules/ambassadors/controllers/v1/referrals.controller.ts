// modules/ambassadors/controllers/v1/referrals.controller.ts · the referral engine (caller-owned) + activation.
// create/claim/list are any authenticated user (own referrals); create needs an Idempotency-Key. activate needs
// ambassador.manage (it accrues commission). `ambassadors` flag.
import { Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { ReferralService } from '../../services/referral.service';
import { AmbassadorsPermissions, canManageAmbassadors } from '../../policies/ambassadors.policies';
import { CreateReferralSchema, CreateReferralDto, ClaimReferralSchema, ClaimReferralDto } from '../../dto/create-referral.dto';
import { QueryReferralsSchema, QueryReferralsDto } from '../../dto/query-referral.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'ambassadors/referrals', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('ambassadors')
export class ReferralsController {
  constructor(private readonly svc: ReferralService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canManage: canManageAmbassadors(ctx) }; }

  @Post()
  create(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateReferralSchema) dto: CreateReferralDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.create(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }
  @Post('claim')
  claim(@CurrentContext() ctx: RequestContext, @ZodBody(ClaimReferralSchema) dto: ClaimReferralDto) { return this.svc.claim(ctx.tenantId, this.actor(ctx), dto).then((data) => ({ data })); }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryReferralsSchema) q: QueryReferralsDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), { status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Post(':id/activate') @RequirePermissions(AmbassadorsPermissions.Manage)
  activate(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.activate(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
}
