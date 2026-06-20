// modules/ai-governance/controllers/v1/models.controller.ts · READ-ONLY model registry (browse + get).
// Authoring/promotion is admin-api (Law 11) — not exposed here. Needs ai.review. `ai_governance` flag.
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { AiModelService } from '../../services/ai-model.service';
import { AiPermissions } from '../../policies/ai-governance.policies';
import { QueryModelsSchema, QueryModelsDto } from '../../dto/query-ai-model.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'ai/models', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('ai_governance')
export class ModelsController {
  constructor(private readonly svc: AiModelService) {}

  @Get() @RequirePermissions(AiPermissions.Review)
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryModelsSchema) q: QueryModelsDto) {
    return this.svc.list(ctx.tenantId, { code: q.code, status: q.status, limit: q.limit, cursor: decodeCursor(q.cursor) }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':id') @RequirePermissions(AiPermissions.Review)
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getById(ctx.tenantId, id).then((data) => ({ data }));
  }
}
