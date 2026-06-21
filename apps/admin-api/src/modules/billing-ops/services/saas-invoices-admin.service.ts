// apps/admin-api/src/modules/billing-ops/services/saas-invoices-admin.service.ts · browse SaaS invoices and drive
// the consequential admin status transitions (issue / mark_overdue / void). One ACID tx per write (Law 4); every
// transition writes an append-only audit_log row IN THE SAME TX (§4). Status changes go ONLY through the invoice
// state machine (Law 5). 'paid'/'partially_paid' are NOT settable here — they arrive from payment reconciliation;
// the only money-affecting write-off is 'void', always with a reason. No ledger posting (Law 2/9).
import { Injectable } from '@nestjs/common';
import { AdminPool } from '../../../core/database/admin-pool';
import { AdminAuditWriter } from '../../../core/audit/admin-audit.writer';
import { AdminRequestContext } from '../../../core/auth/admin-auth.guard';
import { BillingRepository, InvoiceListQuery } from '../repositories/billing.repository';
import { SaasInvoiceNotFoundError } from '../domain/billing-ops.errors';
import { UpdateInvoiceDto } from '../dto/billing-ops.dto';

@Injectable()
export class SaasInvoicesAdminService {
  constructor(private readonly pool: AdminPool, private readonly audit: AdminAuditWriter, private readonly repo: BillingRepository) {}

  async list(q: InvoiceListQuery) {
    const items = (await this.repo.listInvoices(q)).map((i) => i.toJSON());
    const last = items[items.length - 1] as any;
    const nextCursor = items.length === q.limit && last
      ? Buffer.from(`${last.createdAt?.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  async get(id: string) {
    const inv = await this.repo.getInvoice(id);
    if (!inv) throw new SaasInvoiceNotFoundError(id);
    return inv.toJSON();
  }

  async update(actor: AdminRequestContext, id: string, dto: UpdateInvoiceDto) {
    return this.pool.withTx(async (client) => {
      const inv = await this.repo.getInvoiceForUpdate(client, id);
      if (!inv) throw new SaasInvoiceNotFoundError(id);
      const before = inv.status;
      const change = dto.action === 'issue' ? inv.issue()
        : dto.action === 'mark_overdue' ? inv.markOverdue()
        : inv.void();                                            // throws on illegal transition (Law 5)
      await this.repo.updateInvoiceStatus(client, id, change.to, actor.userId);
      await this.audit.write(client, { actorUserId: actor.userId, actorRole: actor.roles[0] ?? null,
        action: `billing.invoice_${change.to}`, entityType: 'saas_invoice', entityId: id,
        oldValue: { status: before }, newValue: { status: change.to }, reason: dto.reason, ip: actor.ip, requestId: actor.requestId || null });
      return inv.toJSON();
    });
  }
}
