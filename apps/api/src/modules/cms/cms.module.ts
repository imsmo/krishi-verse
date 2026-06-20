// modules/cms/cms.module.ts
// CMS (PRD §50) — tenant content pages + promotional banners. Pages are VERSIONED (draft → published →
// archived; a published page is re-edited by minting a new version, so the live content is immutable); banners
// run in a scheduled [starts,ends) window at a placement, with atomic click tracking. Authoring needs cms.manage
// (audited); published pages + live banners are readable by any authenticated user. Money-free. Gated by the
// `cms` flag (default OFF).
//
// SCOPE: page authoring/versioning/publish + banner scheduling/serve/click + banner-expiry job. DEFERRED:
// per-language page translations (the translations table), banner audience-rule targeting eval, page preview
// tokens, scheduled page publish.
import { Module } from '@nestjs/common';
import { PagesController } from './controllers/v1/pages.controller';
import { BannersController } from './controllers/v1/banners.controller';
import { CmsPageService } from './services/cms-page.service';
import { BannerService } from './services/banner.service';
import { CmsPageRepository } from './repositories/cms-page.repository';
import { BannerRepository } from './repositories/banner.repository';

@Module({
  controllers: [PagesController, BannersController],
  providers: [CmsPageService, BannerService, CmsPageRepository, BannerRepository],
  exports: [CmsPageService, BannerService],
})
export class CmsModule {}
