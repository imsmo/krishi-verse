// modules/labour/controllers/v1/workers.controller.ts · worker self-registration + profile + browse.
// register/me/update act on the CALLER's own profile (userId is ctx.userId, never client-supplied).
// Browsing the worker pool (list/get) needs worker.book (an employer). Gated by the `labour` flag.
import { Controller, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { WorkerProfileService } from '../../services/worker-profile.service';
import { RegisterWorkerSchema, RegisterWorkerDto } from '../../dto/create-worker-profile.dto';
import { UpdateWorkerSchema, UpdateWorkerDto } from '../../dto/update-worker-profile.dto';
import { QueryWorkersSchema, QueryWorkersDto } from '../../dto/query-worker-profile.dto';
import { LabourPermissions } from '../../policies/labour.policies';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'labour/workers', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('labour')
export class WorkersController {
  constructor(private readonly workers: WorkerProfileService) {}

  @Post()
  register(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(RegisterWorkerSchema) dto: RegisterWorkerDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.workers.register(ctx.tenantId, ctx.userId, key, dto).then((data) => ({ data }));
  }

  @Get('me')
  me(@CurrentContext() ctx: RequestContext) { return this.workers.getMine(ctx.tenantId, ctx.userId).then((data) => ({ data })); }

  @Patch('me')
  updateMe(@CurrentContext() ctx: RequestContext, @ZodBody(UpdateWorkerSchema) dto: UpdateWorkerDto) {
    return this.workers.getMine(ctx.tenantId, ctx.userId).then((mine) => {
      if (!mine.worker) throw new BadRequestError('Register a worker profile first');
      return this.workers.updateMine(ctx.tenantId, ctx.userId, mine.worker.id, dto).then((data) => ({ data }));
    });
  }

  @Get() @RequirePermissions(LabourPermissions.Book)
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryWorkersSchema) q: QueryWorkersDto) {
    return this.workers.list(ctx.tenantId, { villageRegionId: q.villageRegionId, ageVerified: q.ageVerified, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Get(':id') @RequirePermissions(LabourPermissions.Book)
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.workers.getById(ctx.tenantId, id).then((data) => ({ data })); }
}
