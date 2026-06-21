// apps/admin-api/src/modules/announcements/announcements.controller.ts · god-mode platform-announcements surface
// (Law 11). Every route: AdminAuthGuard + OwnerPermissionsGuard. Reads need announcements.read; MUTATIONS (create/
// update/schedule/publish/expire/archive) need announcements.manage + HardwareKeyGuard (FIDO2) + StepUpReauthGuard
// (a platform-wide notice reaches every tenant). validate (zod) → authorize → delegate ONLY. Plain-text content,
// no money. Static route (/active) declared before :id.
import { Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AdminAuthGuard, AdminRequestContext } from '../../core/auth/admin-auth.guard';
import { HardwareKeyGuard } from '../../core/auth/hardware-key.guard';
import { StepUpReauthGuard } from '../../core/auth/step-up-reauth.guard';
import { OwnerPermissionsGuard, RequireOwnerPermission, OwnerPermissions } from '../../core/rbac/owner-roles';
import { ZodBody, ZodQuery } from '../../core/http/zod.pipe';
import { AnnouncementCrudService } from './services/announcement-crud.service';
import {
  QueryAnnouncementsSchema, QueryAnnouncementsDto, QueryChangesSchema, QueryChangesDto,
  CreateAnnouncementSchema, CreateAnnouncementDto, UpdateAnnouncementSchema, UpdateAnnouncementDto,
  ScheduleAnnouncementSchema, ScheduleAnnouncementDto, PublishAnnouncementSchema, PublishAnnouncementDto,
  LifecycleReasonSchema, LifecycleReasonDto,
} from './dto/announcements.dto';

const decodeCursor = (c?: string) => { if (!c) return undefined; const [cc, id] = Buffer.from(c, 'base64').toString().split('|'); return cc && id ? { c: cc, id } : undefined; };
const admin = (req: any): AdminRequestContext => req.admin;

@Controller({ path: 'announcements', version: '1' })
@UseGuards(AdminAuthGuard, OwnerPermissionsGuard)
export class AnnouncementsController {
  constructor(private readonly svc: AnnouncementCrudService) {}

  // ---- reads ----
  @Get('active') @RequireOwnerPermission(OwnerPermissions.AnnouncementsRead)
  active() { return this.svc.active().then((res) => ({ data: res.items })); }

  @Get() @RequireOwnerPermission(OwnerPermissions.AnnouncementsRead)
  list(@ZodQuery(QueryAnnouncementsSchema) q: QueryAnnouncementsDto) {
    return this.svc.list({ status: q.status, severity: q.severity, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }
  @Get(':id') @RequireOwnerPermission(OwnerPermissions.AnnouncementsRead)
  get(@Param('id') id: string) { return this.svc.get(id).then((data) => ({ data })); }

  @Get(':id/history') @RequireOwnerPermission(OwnerPermissions.AnnouncementsRead)
  history(@Param('id') id: string, @ZodQuery(QueryChangesSchema) q: QueryChangesDto) {
    return this.svc.history({ announcementId: id, cursor: decodeCursor(q.cursor), limit: q.limit })
      .then((res) => ({ data: res.items, meta: { nextCursor: res.nextCursor } }));
  }

  // ---- mutations: manage perm + FIDO2 + step-up ----
  @Post() @RequireOwnerPermission(OwnerPermissions.AnnouncementsManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  create(@Req() req: any, @ZodBody(CreateAnnouncementSchema) dto: CreateAnnouncementDto) {
    return this.svc.create(admin(req), dto).then((data) => ({ data }));
  }
  @Patch(':id') @RequireOwnerPermission(OwnerPermissions.AnnouncementsManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  update(@Req() req: any, @Param('id') id: string, @ZodBody(UpdateAnnouncementSchema) dto: UpdateAnnouncementDto) {
    return this.svc.update(admin(req), id, dto).then((data) => ({ data }));
  }
  @Post(':id/schedule') @RequireOwnerPermission(OwnerPermissions.AnnouncementsManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  schedule(@Req() req: any, @Param('id') id: string, @ZodBody(ScheduleAnnouncementSchema) dto: ScheduleAnnouncementDto) {
    return this.svc.schedule(admin(req), id, dto).then((data) => ({ data }));
  }
  @Post(':id/publish') @RequireOwnerPermission(OwnerPermissions.AnnouncementsManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  publish(@Req() req: any, @Param('id') id: string, @ZodBody(PublishAnnouncementSchema) dto: PublishAnnouncementDto) {
    return this.svc.publish(admin(req), id, dto).then((data) => ({ data }));
  }
  @Post(':id/expire') @RequireOwnerPermission(OwnerPermissions.AnnouncementsManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  expire(@Req() req: any, @Param('id') id: string, @ZodBody(LifecycleReasonSchema) dto: LifecycleReasonDto) {
    return this.svc.expire(admin(req), id, dto.reason).then((data) => ({ data }));
  }
  @Post(':id/archive') @RequireOwnerPermission(OwnerPermissions.AnnouncementsManage) @UseGuards(HardwareKeyGuard, StepUpReauthGuard)
  archive(@Req() req: any, @Param('id') id: string, @ZodBody(LifecycleReasonSchema) dto: LifecycleReasonDto) {
    return this.svc.archive(admin(req), id, dto.reason).then((data) => ({ data }));
  }
}
