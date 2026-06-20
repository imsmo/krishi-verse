// modules/traceability/services/public-scan.service.ts · the ANONYMOUS farm-to-fork QR read.
// No auth: possession of the unguessable qr_token IS the capability. Reads via the SECURITY DEFINER trace_scan()
// function (db/migrations/0028) — the ONLY RLS-bypass path — which returns a curated, NON-PII projection (no
// tenant_id, no farmer user id / phone). Flag-gated (fail-closed: returns 404 when `traceability` is off). The
// scan never reveals whether a token exists for a disabled tenant beyond the generic 404.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { METRICS, Metrics } from '../../../core/observability/metrics';
import { FlagsService } from '../../../core/feature-flags/flags.service';
import { TraceLotRepository } from '../repositories/trace-lot.repository';
import { ScanNotFoundError } from '../domain/traceability.errors';

const TOKEN_RE = /^[A-Za-z0-9_-]{6,40}$/;   // anchored — reject junk before touching the DB

@Injectable()
export class PublicScanService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly flags: FlagsService,
    private readonly lots: TraceLotRepository,
  ) {}
  async scan(qrToken: string) {
    if (!await this.flags.isEnabled('traceability')) throw new ScanNotFoundError();   // fail-closed
    if (!TOKEN_RE.test(qrToken)) throw new ScanNotFoundError();
    this.metrics.inc('trace.scan');
    const provenance = await this.uow.run('', (tx) => this.lots.scan(tx, qrToken));   // RLS-bypass via trace_scan()
    if (!provenance) throw new ScanNotFoundError();
    return provenance;
  }
}
