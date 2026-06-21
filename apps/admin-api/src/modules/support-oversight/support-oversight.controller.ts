// apps/admin-api/src/modules/support-oversight/support-oversight.controller.ts · god-mode cross-tenant support
// oversight (Law 11). Every route: AdminAuthGuard + OwnerPermissionsGuard. Reads need support.oversight.read; the
// one MUTATION (escalate — a cross-tenant override) needs support.oversight.manage + HardwareKeyGuard (FIDO2) +
// StepUpReauthGuard. validate (zod) → authorize (owner perm) → delegate ONLY. No money path (support is a helpdesk).
import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, AdminRequestContext } from '../../core/auth/admin-auth.guard';
import { HardwareKeyGuard } from '../../core/auth/hardware-key.guard';
import { StepUpReauthGuard } from '../../core/auth/step-up-reauth.guard';
import { OwnerPermissionsGuard, RequireOwnerPermission, OwnerPermissions } from '../../core/rbac/owner-roles';
import { ZodBody, ZodQuery } from '../../core/http/zod.pipe';
import { SlaBreachMonitorService } from './services/sla-breach-monitor.service';
import { TenantHealthAlertsService } from './services/tenant-health-alerts.service';
import { TicketEscalationsService } from './services/ticket-escalations.service';
import {
  QueryTicketsSchema, QueryTicketsDto, QueryBreachesSchema, QueryBreachesDto,
  TenantHealthSchema, TenantHealthDto, EscalateTicketSchema, EscalateTicketDto,
} from './dto/support-oversight.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };
const toBool = (v?: string) => (v === undefined ? undefined : v === 'true');
const admin = (req: any): AdminRequestContext => req.admin;

@Controller({ path: 'support', version: '1' })
@UseGuards(AdminAuthGuard, OwnerPermissionsGuard)
export class SupportOversightController {
  constructor(
    private readonly monitor: SlaBreachMonitorService,
    private readonly health: TenantHealthAlertsService,
    private readonly escalations: TicketEscalationsService,
  ) {}

  // ---- reads (cross-tenant NOC) ----
  @Get('tickets') @RequireOwnerPermission(OwnerPermissions.SupportOversightRead)
  listTickets(@ZodQuery(QueryTicketsSchema) q: QueryTicketsDto) {
    return this.monitor.listTickets({ tenantId: q.tenantId, status: q.status, severity: q.severity, slaBreached: toBool(q.slaBreached), assigned: toBool(q.assigned), cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get('sla-breaches') @RequireOwnerPermission(OwnerPermissions.SupportOversightRead)
  listBreaches(@ZodQuery(QueryBreachesSchema) q: QueryBreachesDto) {
    return this.monitor.listBreaches({ tenantId: q.tenantId, severity: q.severity, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get('tenant-health') @RequireOwnerPermission(OwnerPermissions.SupportOversightRead)
  tenantHealth(@ZodQuery(TenantHealthSchema) q: TenantHealthDto) {
    return this.health.health(q).then((res) => ({ data: res.items }));
  }
  @Get('tickets/:id') @RequireOwnerPermission(OwnerPermissions.SupportOversightRead)
  getTicket(@Param('id') id: string) { return this.monitor.getTicket(id).then((data) => ({ data })); }

  // ---- mutation: cross-tenant override → manage perm + FIDO2 + step-up ----
  @Post('tickets/:id/escalate') @RequireOwnerPermission(OwnerPermissions.SupportOversightManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  escalate(@Req() req: any, @Param('id') id: string, @ZodBody(EscalateTicketSchema) dto: EscalateTicketDto) {
    return this.escalations.escalate(admin(req), id, dto).then((data) => ({ data }));
  }
}
