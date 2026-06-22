// modules/requirements/controllers/v1/requirements.controller.ts · demand posts + seller quotes
// (validate→authorize→delegate). Post needs requirement.post + Idempotency-Key; quoting needs
// requirement.quote + Idempotency-Key. Buyer-vs-seller authority is enforced in the services.
// List/get of open requirements is public-within-tenant. Gated by the `requirements` flag.
import { Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Req } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { RequirementService } from '../../services/requirement.service';
import { RequirementResponseService } from '../../services/requirement-response.service';
import { CreateRequirementSchema, CreateRequirementDto } from '../../dto/create-requirement.dto';
import { UpdateRequirementSchema, UpdateRequirementDto } from '../../dto/update-requirement.dto';
import { CreateResponseSchema, CreateResponseDto } from '../../dto/create-requirement-response.dto';
import { QueryRequirementsSchema, QueryRequirementsDto } from '../../dto/query-requirement.dto';
import { QueryResponsesSchema, QueryResponsesDto } from '../../dto/query-requirement-response.dto';
import { RequirementPermissions, canModerateRequirement } from '../../policies/requirements.policies';

const ipOf = (r: Request) => r.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'requirements', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('requirements')
export class RequirementsController {
  constructor(private readonly requirements: RequirementService, private readonly responses: RequirementResponseService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canModerate: canModerateRequirement(ctx) }; }

  @Post() @RequirePermissions(RequirementPermissions.Post)
  post(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateRequirementSchema) dto: CreateRequirementDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.requirements.create(ctx.tenantId, ctx.userId, key, dto).then((data) => ({ data }));
  }

  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryRequirementsSchema) q: QueryRequirementsDto) {
    return this.requirements.list(ctx.tenantId, this.actor(ctx), { box: q.box, status: q.status, categoryId: q.categoryId, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.requirements.getById(ctx.tenantId, id).then((data) => ({ data })); }

  @Patch(':id') @RequirePermissions(RequirementPermissions.Post)
  update(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string, @ZodBody(UpdateRequirementSchema) dto: UpdateRequirementDto) {
    return this.requirements.update(ctx.tenantId, this.actor(ctx), id, dto, ipOf(r)).then((data) => ({ data }));
  }

  @Post(':id/close')
  close(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string) { return this.requirements.close(ctx.tenantId, this.actor(ctx), id, ipOf(r)).then((data) => ({ data })); }

  @Post(':id/responses') @RequirePermissions(RequirementPermissions.Quote)
  quote(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @Headers('idempotency-key') key: string, @ZodBody(CreateResponseSchema) dto: CreateResponseDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.responses.submit(ctx.tenantId, ctx.userId, id, key, dto).then((data) => ({ data }));
  }

  @Get(':id/responses')
  listResponses(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodQuery(QueryResponsesSchema) q: QueryResponsesDto) {
    return this.responses.listForRequirement(ctx.tenantId, this.actor(ctx), id, { status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
}
