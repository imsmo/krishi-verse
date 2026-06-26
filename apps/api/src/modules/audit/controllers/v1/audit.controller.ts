// modules/audit/controllers/v1/audit.controller.ts · read-only audit-trail browse for the tenant auditor.
// validate→authorize→delegate only. GET-only (the trail is immutable). `audit_trail` flag + `audit.read` perm.
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { NotFoundError } from '../../../../shared/errors/app-error';
import { AuditService } from '../../services/audit.service';
import { AuditPermissions, canReadAudit } from '../../policies/audit.policies';
import { QueryAuditSchema, QueryAuditDto } from '../../dto/audit.dto';

@Controller({ path: 'audit/entries', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('audit_trail')
export class AuditController {
  constructor(private readonly svc: AuditService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canRead: canReadAudit(ctx) }; }

  @Get() @RequirePermissions(AuditPermissions.Read)
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryAuditSchema) q: QueryAuditDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), q).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  @Get(':id') @RequirePermissions(AuditPermissions.Read)
  async get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) {
    const entry = await this.svc.getById(ctx.tenantId, this.actor(ctx), id);
    if (!entry) throw new NotFoundError('Audit entry not found');
    return { data: entry };
  }
}
