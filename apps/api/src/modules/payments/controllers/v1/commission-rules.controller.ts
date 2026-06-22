// modules/payments/controllers/v1/commission-rules.controller.ts · a tenant finance admin manages its OWN
// commission-rule overrides (validate→authorize→delegate, no logic). Platform-default rules (tenant_id NULL) are
// god-mode (admin-api) and are never writable here — every write binds ctx.tenantId. Creates require an
// Idempotency-Key; lists are keyset/bounded.
import { Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { CommissionRuleService } from '../../services/commission-rule.service';
import { CreateCommissionRuleSchema, CreateCommissionRuleDto } from '../../dto/create-commission-rule.dto';
import { QueryCommissionRuleSchema, QueryCommissionRuleDto } from '../../dto/query-commission-rule.dto';
import { canManageCommissionRules } from '../../policies/payments.policies';

const ipOf = (r: Request) => r.ip || null;
const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };
const reqKey = (k: string) => { if (!k) throw new BadRequestError('Idempotency-Key header required'); return k; };

@Controller({ path: 'commission-rules', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class CommissionRulesController {
  constructor(private readonly rules: CommissionRuleService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canManage: canManageCommissionRules(ctx) }; }

  @Post() @RequirePermissions('payout.approve')
  create(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Headers('idempotency-key') key: string, @ZodBody(CreateCommissionRuleSchema) dto: CreateCommissionRuleDto) {
    return this.rules.create(ctx.tenantId, this.actor(ctx), reqKey(key), dto, ipOf(r)).then((data) => ({ data }));
  }

  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryCommissionRuleSchema) q: QueryCommissionRuleDto) {
    return this.rules.list(ctx.tenantId, { ...q, cursor: decodeCursor(q.cursor) }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Post(':id/deactivate') @RequirePermissions('payout.approve')
  deactivate(@CurrentContext() ctx: RequestContext, @Req() r: Request, @Param('id') id: string) {
    return this.rules.setActive(ctx.tenantId, this.actor(ctx), id, false, ipOf(r)).then((data) => ({ data }));
  }
}
