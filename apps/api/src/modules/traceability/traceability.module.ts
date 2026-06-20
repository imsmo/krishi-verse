// modules/traceability/traceability.module.ts
// Traceability — farm-to-fork QR (PRD §16.3). A farmer/ops opens a traceable lot (qr_token = public capability)
// and appends a tamper-evident, HASH-CHAINED journey (harvested→listed→sold→packed→picked→in_transit→delivered).
// A consumer scans the QR with NO auth and gets a curated, non-PII provenance (via the SECURITY DEFINER
// trace_scan function, db/migrations/0028). An anchor job stamps each lot's chain head as its blockchain_anchor.
// Money-free. Gated by the `traceability` flag (default OFF).
//
// SCOPE: trace-lot create + manual journey append (hash-chained) + owner/manager reads + public QR scan +
// anchor job. DEFERRED: auto-fanout of journey events from order/shipment outbox (the emitting modules don't yet
// carry listing_id in their payloads — appendForListing() is ready for when they do) + on-chain anchoring.
import { Module } from '@nestjs/common';
import { TraceLotsController } from './controllers/v1/trace-lots.controller';
import { PublicScanController } from './controllers/v1/public-scan.controller';
import { TraceLotService } from './services/trace-lot.service';
import { PublicScanService } from './services/public-scan.service';
import { TraceLotRepository } from './repositories/trace-lot.repository';
import { TraceEventRepository } from './repositories/trace-event.repository';

@Module({
  controllers: [TraceLotsController, PublicScanController],
  providers: [TraceLotService, PublicScanService, TraceLotRepository, TraceEventRepository],
  exports: [TraceLotService],
})
export class TraceabilityModule {}
