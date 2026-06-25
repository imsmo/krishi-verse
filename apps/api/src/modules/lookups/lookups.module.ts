// modules/lookups/lookups.module.ts · public reference-data reads (controlled vocabularies + admin regions).
// Read-only; relies on the @Global CoreModule (replica + cache + metrics). No feature flag — reference data is a
// core read every app needs to render pickers/facets (not a toggleable product feature).
import { Module } from '@nestjs/common';
import { LookupsController } from './controllers/v1/lookups.controller';
import { LookupsService } from './lookups.service';

@Module({
  controllers: [LookupsController],
  providers: [LookupsService],
  exports: [LookupsService],
})
export class LookupsModule {}
