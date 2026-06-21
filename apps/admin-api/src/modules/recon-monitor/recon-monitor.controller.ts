// apps/admin-api/src/modules/recon-monitor/recon-monitor.controller.ts · god-mode money-safety surface (Law 11).
// Every route: AdminAuthGuard + OwnerPermissionsGuard. MUTATIONS (open/update investigation, freeze/unfreeze)
// additionally require HardwareKeyGuard (FIDO2) + StepUpReauthGuard — JIT elevation for consequential money
// controls. validate (zod) → authorize (owner perm) → delegate. No business logic here. NEVER posts the ledger.
import { Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, AdminRequestContext } from '../../core/auth/admin-auth.guard';
import { HardwareKeyGuard } from '../../core/auth/hardware-key.guard';
import { StepUpReauthGuard } from '../../core/auth/step-up-reauth.guard';
import { OwnerPermissionsGuard, RequireOwnerPermission, OwnerPermissions } from '../../core/rbac/owner-roles';
import { ZodBody, ZodQuery } from '../../core/http/zod.pipe';
import { WalletReconDashboardService } from './services/wallet-recon-dashboard.service';
import { MismatchInvestigationsService } from './services/mismatch-investigations.service';
import { LedgerFreezeControlsService } from './services/ledger-freeze-controls.service';
import {
  QueryRunsSchema, QueryRunsDto, QueryInvestigationsSchema, QueryInvestigationsDto,
  OpenInvestigationSchema, OpenInvestigationDto, UpdateInvestigationSchema, UpdateInvestigationDto,
  FreezeAccountSchema, FreezeAccountDto,
} from './dto/recon-monitor.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };
const admin = (req: any): AdminRequestContext => req.admin;

@Controller({ path: 'recon', version: '1' })
@UseGuards(AdminAuthGuard, OwnerPermissionsGuard)
export class ReconMonitorController {
  constructor(
    private readonly dashboard: WalletReconDashboardService,
    private readonly investigations: MismatchInvestigationsService,
    private readonly freeze: LedgerFreezeControlsService,
  ) {}

  // ---- reads ----
  @Get('overview') @RequireOwnerPermission(OwnerPermissions.ReconRead)
  overview() { return this.dashboard.overview().then((data) => ({ data })); }

  @Get('runs') @RequireOwnerPermission(OwnerPermissions.ReconRead)
  listRuns(@ZodQuery(QueryRunsSchema) q: QueryRunsDto) {
    return this.dashboard.listRuns({ runType: q.runType, status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get('runs/:id') @RequireOwnerPermission(OwnerPermissions.ReconRead)
  getRun(@Param('id') id: string) { return this.dashboard.getRun(id).then((data) => ({ data })); }

  @Get('accounts/:id') @RequireOwnerPermission(OwnerPermissions.ReconRead)
  getAccount(@Param('id') id: string) { return this.dashboard.getAccount(id).then((data) => ({ data })); }

  @Get('investigations') @RequireOwnerPermission(OwnerPermissions.ReconRead)
  listInvestigations(@ZodQuery(QueryInvestigationsSchema) q: QueryInvestigationsDto) {
    return this.investigations.list({ status: q.status, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get('investigations/:id') @RequireOwnerPermission(OwnerPermissions.ReconRead)
  getInvestigation(@Param('id') id: string) { return this.investigations.get(id).then((data) => ({ data })); }

  // ---- mutations: hardware-key + step-up elevation required ----
  @Post('investigations') @RequireOwnerPermission(OwnerPermissions.ReconManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  openInvestigation(@Req() req: any, @ZodBody(OpenInvestigationSchema) dto: OpenInvestigationDto) {
    return this.investigations.open(admin(req), dto).then((data) => ({ data }));
  }
  @Patch('investigations/:id') @RequireOwnerPermission(OwnerPermissions.ReconManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  updateInvestigation(@Req() req: any, @Param('id') id: string, @ZodBody(UpdateInvestigationSchema) dto: UpdateInvestigationDto) {
    return this.investigations.update(admin(req), id, dto).then((data) => ({ data }));
  }
  @Post('accounts/:id/freeze') @RequireOwnerPermission(OwnerPermissions.ReconManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  freezeAccount(@Req() req: any, @Param('id') id: string, @ZodBody(FreezeAccountSchema) dto: FreezeAccountDto) {
    return this.freeze.setFreeze(admin(req), id, dto).then((data) => ({ data }));
  }
}
