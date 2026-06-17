// modules/payments/services/settlement-statement.service.ts
// Generates a seller's settlement statement for a billing cycle by aggregating that seller's
// UN-statemented settlement_lines in the period, in ONE ACID tx: aggregate (FOR UPDATE) → allocate
// a GST-style sequential statement_no (next_doc_number) → write the statement → link the lines (so
// they're never double-counted next cycle) → audit. Idempotent: re-running a period returns the
// existing statement. Reads (list/get) are owner-scoped on the replica (404 to non-owners — no IDOR).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { SettlementLineRepository } from '../repositories/settlement-line.repository';
import { SettlementStatementRepository, SettlementStatementRow } from '../repositories/settlement-statement.repository';
import { NoSettlementLinesError, StatementNotFoundError } from '../domain/billing.errors';
import { DocumentPdfService } from './document-pdf.service';

export interface StatementActor { userId: string; canModerate: boolean; }

@Injectable()
export class SettlementStatementService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly lines: SettlementLineRepository,
    private readonly statements: SettlementStatementRepository,
    private readonly pdf: DocumentPdfService,
  ) {}

  /** Generate (or return the existing) statement for a seller + [from, to) cycle. Finance action.
   *  After the statement commits, attach a PDF (flag-gated, best-effort — a PDF failure never fails
   *  statement generation; it can be regenerated). */
  async generate(tenantId: string, sellerUserId: string, from: string, to: string, actorUserId: string, ip: string | null): Promise<SettlementStatementRow> {
    const row = await timed(this.metrics, 'payments.generate_statement', { tenant: tenantId }, async () =>
      this.uow.run(tenantId, async (tx) => {
        const existing = await this.statements.findForPeriod(tx, tenantId, sellerUserId, from, to);
        if (existing) return existing;                          // idempotent

        const agg = await this.lines.aggregateOpenForUpdate(tx, tenantId, sellerUserId, from, to);
        if (agg.lineCount === 0) throw new NoSettlementLinesError({ sellerUserId, from, to });

        const id = uuidv7();
        const statementNo = await this.statements.nextNumber(tx, tenantId, from.slice(0, 7));   // 'YYYY-MM'
        await this.statements.insert(tx, { id, tenantId, sellerUserId, statementNo, from, to, grossMinor: agg.grossMinor, commissionMinor: agg.commissionMinor, taxMinor: agg.taxMinor, netMinor: agg.netMinor });
        await this.lines.linkToStatement(tx, tenantId, sellerUserId, from, to, id);
        await this.audit.write(tx, { tenantId, actorUserId, action: 'settlement.statement_generated', entityType: 'settlement_statement', entityId: id, newValue: { sellerUserId, statementNo, netMinor: agg.netMinor.toString(), lines: agg.lineCount }, ip });
        return { id, statementNo, sellerUserId, periodStart: from, periodEnd: to, grossMinor: agg.grossMinor.toString(), commissionMinor: agg.commissionMinor.toString(), taxMinor: agg.taxMinor.toString(), netMinor: agg.netMinor.toString(), pdfMediaId: null, createdAt: new Date() };
      }, { userId: actorUserId }));

    // attach a rendered PDF (flag-gated; best-effort — never fail statement generation on a PDF error)
    try { await this.pdf.storeStatementPdf(tenantId, row); } catch { this.metrics.inc('payments.statement_pdf_failed', { tenant: tenantId }); }
    return row;
  }

  async getById(tenantId: string, actor: StatementActor, id: string): Promise<SettlementStatementRow> {
    const s = await this.statements.getVisible(tenantId, id, actor.userId, actor.canModerate);
    if (!s) throw new StatementNotFoundError();
    return s;
  }

  async listForSeller(tenantId: string, sellerUserId: string, q: { cursor?: { c: string; id: string }; limit: number }) {
    const items = await this.statements.listForSeller(tenantId, sellerUserId, q);
    const last = items[items.length - 1];
    return { items, nextCursor: items.length === q.limit && last ? Buffer.from(`${(last.createdAt as Date).toISOString()}|${last.id}`).toString('base64') : null };
  }
}
