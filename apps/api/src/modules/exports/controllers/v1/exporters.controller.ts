// modules/exports/controllers/v1/exporters.controller.ts · exporter RCMC/IEC registration + compliance browse. `exports` flag.
import { Controller, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { ExporterRegistrationService } from '../../services/exporter-registration.service';
import { ComplianceRequirementService } from '../../services/compliance-requirement.service';
import { RegisterExporterSchema, RegisterExporterDto } from '../../dto/create-exporter-registration.dto';
import { UpdateExporterSchema, UpdateExporterDto } from '../../dto/update-exporter-registration.dto';
import { QueryExportersSchema, QueryExportersDto } from '../../dto/query-exporter-registration.dto';
import { QueryComplianceSchema, QueryComplianceDto } from '../../dto/query-compliance-requirement.dto';
import { ExportsPermissions, canManageExports, isExportsAdmin } from '../../policies/exports.policies';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };

@Controller({ path: 'exports/exporters', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('exports')
export class ExportersController {
  constructor(private readonly svc: ExporterRegistrationService, private readonly compliance: ComplianceRequirementService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canManage: canManageExports(ctx), isAdmin: isExportsAdmin(ctx) }; }

  @Post() @RequirePermissions(ExportsPermissions.Manage)
  register(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(RegisterExporterSchema) dto: RegisterExporterDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    return this.svc.register(ctx.tenantId, this.actor(ctx), key, dto).then((data) => ({ data }));
  }
  @Get()
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryExportersSchema) q: QueryExportersDto) {
    return this.svc.list(ctx.tenantId, this.actor(ctx), { box: q.box, cursor: decodeCursor(q.cursor), limit: q.limit }).then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  // compliance reference data (read-only) — placed before :id so it isn't shadowed
  @Get('compliance')
  compliance_(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryComplianceSchema) q: QueryComplianceDto) {
    return this.compliance.list(ctx.tenantId, q.destinationCountry, q.categoryId).then((data) => ({ data }));
  }
  @Get(':id')
  get(@CurrentContext() ctx: RequestContext, @Param('id') id: string) { return this.svc.getById(ctx.tenantId, this.actor(ctx), id).then((data) => ({ data })); }
  @Patch(':id') @RequirePermissions(ExportsPermissions.Manage)
  update(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(UpdateExporterSchema) dto: UpdateExporterDto) { return this.svc.update(ctx.tenantId, this.actor(ctx), id, dto).then((data) => ({ data })); }
}
