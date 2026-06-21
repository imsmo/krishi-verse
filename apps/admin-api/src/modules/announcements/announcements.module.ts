// apps/admin-api/src/modules/announcements/announcements.module.ts · the god-mode PLATFORM-ANNOUNCEMENTS plane
// (Law 11). Owns platform_announcements: author/schedule/publish/expire/archive platform-wide banners + notices
// (maintenance windows, incident notices, product news) shown across tenant panels/apps. Plain-text content, a
// draft→scheduled→published→expired/archived lifecycle, audience targeting, fully audited. Mounts under
// AdminCoreModule (auth/RBAC/FIDO2/step-up/audit @Global).
import { Module } from '@nestjs/common';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsRepository } from './repositories/announcements.repository';
import { AnnouncementCrudService } from './services/announcement-crud.service';

@Module({
  controllers: [AnnouncementsController],
  providers: [AnnouncementsRepository, AnnouncementCrudService],
})
export class AnnouncementsModule {}
