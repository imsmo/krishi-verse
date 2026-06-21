// apps/admin-api/src/modules/flags-ops/flags-ops.controller.ts · god-mode feature-flag surface (Law 10 + Law 11).
// Every route: AdminAuthGuard + OwnerPermissionsGuard. MUTATIONS (create + the PATCH actions incl. KILL-SWITCH)
// additionally require HardwareKeyGuard (FIDO2) + StepUpReauthGuard — a global flag flip affects every tenant, so
// it's treated as a consequential control. validate (zod) → authorize (owner perm) → delegate. No business logic
// here: the PATCH discriminated body is dispatched by action to the kill-switch / percent-rollout services.
import { Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, AdminRequestContext } from '../../core/auth/admin-auth.guard';
import { HardwareKeyGuard } from '../../core/auth/hardware-key.guard';
import { StepUpReauthGuard } from '../../core/auth/step-up-reauth.guard';
import { OwnerPermissionsGuard, RequireOwnerPermission, OwnerPermissions } from '../../core/rbac/owner-roles';
import { ZodBody, ZodQuery } from '../../core/http/zod.pipe';
import { GlobalFlagsService } from './services/global-flags.service';
import { KillSwitchService } from './services/kill-switch.service';
import { PercentRolloutService } from './services/percent-rollout.service';
import {
  QueryFlagsSchema, QueryFlagsDto, QueryFlagHistorySchema, QueryFlagHistoryDto,
  CreateFlagSchema, CreateFlagDto, UpdateFlagSchema, UpdateFlagDto,
} from './dto/flags-ops.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, key: id, id } : undefined; };
const admin = (req: any): AdminRequestContext => req.admin;

@Controller({ path: 'flags', version: '1' })
@UseGuards(AdminAuthGuard, OwnerPermissionsGuard)
export class FlagsOpsController {
  constructor(
    private readonly flags: GlobalFlagsService,
    private readonly killSwitch: KillSwitchService,
    private readonly rollout: PercentRolloutService,
  ) {}

  // ---- reads ----
  @Get() @RequireOwnerPermission(OwnerPermissions.FlagsRead)
  list(@ZodQuery(QueryFlagsSchema) q: QueryFlagsDto) {
    return this.flags.list({ prefix: q.prefix, enabled: q.enabled === undefined ? undefined : q.enabled === 'true', cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':key') @RequireOwnerPermission(OwnerPermissions.FlagsRead)
  get(@Param('key') key: string) { return this.flags.get(key).then((data) => ({ data })); }

  @Get(':key/history') @RequireOwnerPermission(OwnerPermissions.FlagsRead)
  history(@Param('key') key: string, @ZodQuery(QueryFlagHistorySchema) q: QueryFlagHistoryDto) {
    return this.flags.history({ flagKey: key, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  // ---- mutations: hardware-key + step-up elevation required ----
  @Post() @RequireOwnerPermission(OwnerPermissions.FlagsManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  create(@Req() req: any, @ZodBody(CreateFlagSchema) dto: CreateFlagDto) {
    return this.flags.create(admin(req), dto).then((data) => ({ data }));
  }

  @Patch(':key') @RequireOwnerPermission(OwnerPermissions.FlagsManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  update(@Req() req: any, @Param('key') key: string, @ZodBody(UpdateFlagSchema) dto: UpdateFlagDto) {
    const actor = admin(req);
    switch (dto.action) {
      case 'enable': return this.killSwitch.enable(actor, key, dto.reason).then((data) => ({ data }));
      case 'disable': return this.killSwitch.disable(actor, key, dto.reason).then((data) => ({ data }));
      case 'kill': return this.killSwitch.kill(actor, key, dto.reason).then((data) => ({ data }));
      case 'unlock': return this.killSwitch.unlock(actor, key, dto.reason).then((data) => ({ data }));
      case 'set_rollout': return this.rollout.setRollout(actor, key, dto.rolloutPct, dto.reason).then((data) => ({ data }));
      case 'set_targeting': return this.rollout.setTargeting(actor, key, { tenantIds: dto.tenantIds, plans: dto.plans, countries: dto.countries }, dto.reason).then((data) => ({ data }));
    }
  }
}
