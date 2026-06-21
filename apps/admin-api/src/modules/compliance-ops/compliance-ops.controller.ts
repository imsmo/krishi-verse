// apps/admin-api/src/modules/compliance-ops/compliance-ops.controller.ts · god-mode DPDP/compliance surface
// (Law 11). Every route: AdminAuthGuard + OwnerPermissionsGuard. MUTATIONS (DSR decisions, export approvals,
// retention config, breach lifecycle) additionally require HardwareKeyGuard (FIDO2) + StepUpReauthGuard.
// validate (zod) → authorize (owner perm) → delegate. No business logic here.
import { Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, AdminRequestContext } from '../../core/auth/admin-auth.guard';
import { HardwareKeyGuard } from '../../core/auth/hardware-key.guard';
import { StepUpReauthGuard } from '../../core/auth/step-up-reauth.guard';
import { OwnerPermissionsGuard, RequireOwnerPermission, OwnerPermissions } from '../../core/rbac/owner-roles';
import { ZodBody, ZodQuery } from '../../core/http/zod.pipe';
import { DataSubjectRequestsQueueService } from './services/data-subject-requests-queue.service';
import { TenantExportApprovalsService } from './services/tenant-export-approvals.service';
import { AuditLogExplorerService } from './services/audit-log-explorer.service';
import { RetentionPolicyAdminService } from './services/retention-policy-admin.service';
import { BreachResponseConsoleService } from './services/breach-response-console.service';
import {
  QueryDsrSchema, QueryDsrDto, UpdateDsrSchema, UpdateDsrDto,
  QueryExportsSchema, QueryExportsDto, DecideExportSchema, DecideExportDto,
  QueryAuditSchema, QueryAuditDto, UpsertRetentionSchema, UpsertRetentionDto,
  QueryBreachesSchema, QueryBreachesDto, OpenBreachSchema, OpenBreachDto, UpdateBreachSchema, UpdateBreachDto,
} from './dto/compliance-ops.dto';

const ksCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };
const auditCursor = (c?: string) => { if (!c) return undefined; const [ts, id] = Buffer.from(c, 'base64').toString().split('|'); return ts && id ? { ts, id } : undefined; };
const admin = (req: any): AdminRequestContext => req.admin;

@Controller({ path: 'compliance', version: '1' })
@UseGuards(AdminAuthGuard, OwnerPermissionsGuard)
export class ComplianceOpsController {
  constructor(
    private readonly dsr: DataSubjectRequestsQueueService,
    private readonly exports: TenantExportApprovalsService,
    private readonly audit: AuditLogExplorerService,
    private readonly retention: RetentionPolicyAdminService,
    private readonly breaches: BreachResponseConsoleService,
  ) {}

  // ---- DSR queue ----
  @Get('dsr') @RequireOwnerPermission(OwnerPermissions.ComplianceRead)
  listDsr(@ZodQuery(QueryDsrSchema) q: QueryDsrDto) {
    return this.dsr.list({ status: q.status, requestType: q.requestType, cursor: ksCursor(q.cursor), limit: q.limit }).then((r) => ({ data: r.items, meta: { nextCursor: r.nextCursor } }));
  }
  @Get('dsr/:id') @RequireOwnerPermission(OwnerPermissions.ComplianceRead)
  getDsr(@Param('id') id: string) { return this.dsr.get(id).then((data) => ({ data })); }
  @Patch('dsr/:id') @RequireOwnerPermission(OwnerPermissions.ComplianceManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  updateDsr(@Req() req: any, @Param('id') id: string, @ZodBody(UpdateDsrSchema) dto: UpdateDsrDto) {
    return this.dsr.update(admin(req), id, dto).then((data) => ({ data }));
  }

  // ---- export approvals ----
  @Get('exports') @RequireOwnerPermission(OwnerPermissions.ComplianceRead)
  listExports(@ZodQuery(QueryExportsSchema) q: QueryExportsDto) {
    return this.exports.list({ approvalStatus: q.approvalStatus, jobKind: q.jobKind, cursor: ksCursor(q.cursor), limit: q.limit }).then((r) => ({ data: r.items, meta: { nextCursor: r.nextCursor } }));
  }
  @Post('exports/:id/decision') @RequireOwnerPermission(OwnerPermissions.ComplianceManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  decideExport(@Req() req: any, @Param('id') id: string, @ZodBody(DecideExportSchema) dto: DecideExportDto) {
    return this.exports.decide(admin(req), id, dto).then((data) => ({ data }));
  }

  // ---- audit-log explorer (read-only) ----
  @Get('audit') @RequireOwnerPermission(OwnerPermissions.ComplianceRead)
  exploreAudit(@ZodQuery(QueryAuditSchema) q: QueryAuditDto) {
    return this.audit.explore({ actorUserId: q.actorUserId, entityType: q.entityType, entityId: q.entityId, action: q.action, tenantId: q.tenantId, from: q.from, to: q.to, cursor: auditCursor(q.cursor), limit: q.limit }).then((r) => ({ data: r.items, meta: { nextCursor: r.nextCursor } }));
  }

  // ---- retention policies ----
  @Get('retention') @RequireOwnerPermission(OwnerPermissions.ComplianceRead)
  listRetention() { return this.retention.list().then((r) => ({ data: r.items })); }
  @Post('retention') @RequireOwnerPermission(OwnerPermissions.ComplianceManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  upsertRetention(@Req() req: any, @ZodBody(UpsertRetentionSchema) dto: UpsertRetentionDto) {
    return this.retention.upsert(admin(req), dto).then((data) => ({ data }));
  }

  // ---- breach console ----
  @Get('breaches') @RequireOwnerPermission(OwnerPermissions.ComplianceRead)
  listBreaches(@ZodQuery(QueryBreachesSchema) q: QueryBreachesDto) {
    return this.breaches.list({ status: q.status, cursor: ksCursor(q.cursor), limit: q.limit }).then((r) => ({ data: r.items, meta: { nextCursor: r.nextCursor } }));
  }
  @Get('breaches/:id') @RequireOwnerPermission(OwnerPermissions.ComplianceRead)
  getBreach(@Param('id') id: string) { return this.breaches.get(id).then((data) => ({ data })); }
  @Post('breaches') @RequireOwnerPermission(OwnerPermissions.ComplianceManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  openBreach(@Req() req: any, @ZodBody(OpenBreachSchema) dto: OpenBreachDto) {
    return this.breaches.open(admin(req), dto).then((data) => ({ data }));
  }
  @Patch('breaches/:id') @RequireOwnerPermission(OwnerPermissions.ComplianceManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  updateBreach(@Req() req: any, @Param('id') id: string, @ZodBody(UpdateBreachSchema) dto: UpdateBreachDto) {
    return this.breaches.update(admin(req), id, dto).then((data) => ({ data }));
  }
}
