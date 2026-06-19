// modules/exports/exports.module.ts
// Exports & GI (PRD M23): the agri-export compliance + documentation workflow. An exporter registers their
// RCMC/IEC (APEDA/MPEDA/…), creates an export shipment to a destination country, assembles the document
// checklist (BoL, commercial invoice, packing list, CoO, phyto…), and drives the shipment through its
// lifecycle — with a hard gate that it cannot SHIP until every document is verified. Country compliance
// rules (EU MRL, USDA NOP, JAS organic…) are browsable reference data. Gated by `exports` flag (default OFF).
//
// NO in-platform money path: export settlement is via Letter of Credit / bank (external); total_value_minor
// is informational and the 'paid' status merely records that confirmation. (No wallet movement, by design.)
//
// SCOPE (this build): exporter registrations + export shipments (lifecycle + docs-cleared ship gate) +
// document checklist + read-only compliance browse.
// DEFERRED (schema in 0010 / admin surface): authoring compliance_requirements (platform/admin, Law 11),
// RCMC-expiry + doc-checklist reminder jobs, mandatory-doc-set per destination (checklist templating),
// DGFT/ICEGATE + repository API integrations, GI (Geographical Indication) tagging.
import { Module } from '@nestjs/common';
import { ExportersController } from './controllers/v1/exporters.controller';
import { ShipmentsController } from './controllers/v1/shipments.controller';
import { DocumentsController } from './controllers/v1/documents.controller';
import { ExporterRegistrationService } from './services/exporter-registration.service';
import { ExportShipmentService } from './services/export-shipment.service';
import { ExportDocumentService } from './services/export-document.service';
import { ComplianceRequirementService } from './services/compliance-requirement.service';
import { ExporterRegistrationRepository } from './repositories/exporter-registration.repository';
import { ExportShipmentRepository } from './repositories/export-shipment.repository';
import { ExportDocumentRepository } from './repositories/export-document.repository';
import { ComplianceRequirementRepository } from './repositories/compliance-requirement.repository';

@Module({
  controllers: [ExportersController, ShipmentsController, DocumentsController],
  providers: [ExporterRegistrationService, ExportShipmentService, ExportDocumentService, ComplianceRequirementService, ExporterRegistrationRepository, ExportShipmentRepository, ExportDocumentRepository, ComplianceRequirementRepository],
  exports: [ExporterRegistrationService, ExportShipmentService, ExportDocumentService, ComplianceRequirementService],
})
export class ExportsModule {}
