// modules/exports/controllers/v1/documents.controller.ts · export document checklist on a shipment. `exports` flag.
import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { ExportDocumentService } from '../../services/export-document.service';
import { AddDocumentSchema, AddDocumentDto, SetDocumentStatusSchema, SetDocumentStatusDto } from '../../dto/create-export-document.dto';
import { ExportsPermissions, canManageExports, isExportsAdmin } from '../../policies/exports.policies';

@Controller({ path: 'exports', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('exports')
export class DocumentsController {
  constructor(private readonly svc: ExportDocumentService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canManage: canManageExports(ctx), isAdmin: isExportsAdmin(ctx) }; }

  @Post('shipments/:shipmentId/documents') @RequirePermissions(ExportsPermissions.Manage)
  add(@CurrentContext() ctx: RequestContext, @Param('shipmentId') shipmentId: string, @ZodBody(AddDocumentSchema) dto: AddDocumentDto) { return this.svc.add(ctx.tenantId, this.actor(ctx), shipmentId, dto).then((data) => ({ data })); }
  @Get('shipments/:shipmentId/documents')
  list(@CurrentContext() ctx: RequestContext, @Param('shipmentId') shipmentId: string) { return this.svc.list(ctx.tenantId, this.actor(ctx), shipmentId).then((data) => ({ data })); }
  @Post('documents/:id/status') @RequirePermissions(ExportsPermissions.Manage)
  setStatus(@CurrentContext() ctx: RequestContext, @Param('id') id: string, @ZodBody(SetDocumentStatusSchema) dto: SetDocumentStatusDto) { return this.svc.setStatus(ctx.tenantId, this.actor(ctx), id, dto).then((data) => ({ data })); }
}
