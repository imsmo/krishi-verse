// core/bulk/bulk.module.ts · the @Global bulk-import platform. Provides the job lifecycle service, the CSV
// processor, the per-row result store, and the @Global BulkApplierRegistry that domain modules register their
// appliers into (e.g. catalogue registers 'products'). Imports MediaModule for the ObjectStore (to fetch the
// uploaded CSV). Generic plumbing — no business logic about what is imported. Gated by the `bulk_import` flag.
import { Global, Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { BulkImportController } from './controllers/v1/bulk-import.controller';
import { BulkJobService } from './bulk-job.service';
import { BulkImportProcessor } from './csv-import.processor';
import { BulkImportJobRepository } from './bulk-import-job.repository';
import { BulkResultStore } from './bulk-result.store';
import { BulkApplierRegistry, BULK_APPLIER_REGISTRY } from './bulk-applier.registry';

@Global()
@Module({
  imports: [MediaModule],
  controllers: [BulkImportController],
  providers: [
    BulkJobService, BulkImportProcessor, BulkImportJobRepository, BulkResultStore,
    BulkApplierRegistry, { provide: BULK_APPLIER_REGISTRY, useExisting: BulkApplierRegistry },
  ],
  exports: [BulkJobService, BulkImportProcessor, BulkApplierRegistry, BULK_APPLIER_REGISTRY],
})
export class BulkModule {}
