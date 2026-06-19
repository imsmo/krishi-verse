// modules/livestock/controllers/v1/vets.controller.ts · vet self-registration + service catalog + browse.
// register/services act on the CALLER's OWN vet profile (vet.manage). Browse (list/get/me) is any
// authenticated user (farmers shopping for a vet). Gated by the `livestock` flag.
import { Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { VetService } from '../../services/vet.service';
import { RegisterVetSchema, RegisterVetDto, UpsertVetServiceSchema, UpsertVetServiceDto } from '../../dto/create-vet-profile.dto';
import { QueryVetsSchema, QueryVetsDto } from '../../dto/query-vet-profile.dto';
import { LivestockPermissions, canManageVet } from '../../policies/livestock.policies';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'livestock/vets', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('livestock')
export class VetsController {
  constructor(private readonly vets: VetService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canManageVet: canManageVet(ctx) }; }

  @Post() @RequirePermissions(LivestockPermissions.VetManage)
  register(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(RegisterVetSchema) dto: RegisterVetDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.vets.register(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }
  @Post('services') @RequirePermissions(LivestockPermissions.VetManage)
  upsertService(@CurrentContext() ctx: RequestContext, @ZodBody(UpsertVetServiceSchema) dto: UpsertVetServiceDto) { return this.vets.upsertService(ctx.tenantId, this.actor(ctx), dto).then((data) => ({ data })); }
  @Get('me')
  me(@CurrentContext() ctx: RequestContext) { return this.vets.getMine(ctx.tenantId, ctx.userId).then((data) => ({ data })); }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryVetsSchema) q: QueryVetsDto) {
    return this.vets.list(ctx.tenantId, { baseRegionId: q.baseRegionId, isAiTechnician: q.isAiTechnician, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.vets.getById(ctx.tenantId, id).then((data) => ({ data })); }
}
