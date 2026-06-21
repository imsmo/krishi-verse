// apps/admin-api/src/modules/global-catalogue-ops/global-catalogue-ops.module.ts · the god-mode PLATFORM master-
// taxonomy plane (Law 11). Owns the shared vocabulary every tenant's catalogue inherits: the controlled-vocabulary
// registry (lookup_types + PLATFORM lookup_values) and the 5-level category tree (categories). Create/edit/move/
// (de)activate with full audit + change history; reads page by keyset. Mounts under AdminCoreModule (auth / RBAC /
// FIDO2 / step-up / audit @Global). NOTE: attributes, products, synonyms and regulated-rules are larger sibling
// surfaces deferred to follow-on sub-modules (see README) — this plane is the lookup + category master.
import { Module } from '@nestjs/common';
import { GlobalCatalogueOpsController } from './global-catalogue-ops.controller';
import { CatalogueRepository } from './repositories/catalogue.repository';
import { LookupVocabAdminService } from './services/lookup-vocab-admin.service';
import { CategoriesAdminService } from './services/categories-admin.service';

@Module({
  controllers: [GlobalCatalogueOpsController],
  providers: [CatalogueRepository, LookupVocabAdminService, CategoriesAdminService],
})
export class GlobalCatalogueOpsModule {}
