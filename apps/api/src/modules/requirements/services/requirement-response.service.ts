// modules/requirements/services/requirement-response.service.ts
// Seller-quote use-cases on a requirement. Every write: one ACID tx (UoW), status via the machine
// (Law 5), outbox events in the SAME tx (Law 4). NO money moves here — an accepted quote emits
// requirements.quote_accepted (carrying the order inputs) and the order is created downstream
// (orders, Law 11). Seller/listing authority comes from ListingService (Law 11). No version columns →
// the response (and the requirement it fulfils) are locked FOR UPDATE.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { AuditWriter } from '../../../core/audit/audit.writer';
import { uuidv7 } from '../../../core/database/uuid.util';
import { ListingService } from '../../listings/services/listing.service';
import { RequirementResponse } from '../domain/requirement-response.entity';
import { DomainEvent } from '../domain/requirements.events';
import { isLive } from '../domain/requirement-response.state';
import { isAcceptingResponses } from '../domain/requirement.state';
import {
  RequirementNotFoundError, ResponseNotFoundError, RequirementForbiddenError, RequirementNotOpenError,
  SellerIsBuyerError, DuplicateResponseError, InvalidResponseError, ResponseNotAcceptableError,
} from '../domain/requirements.errors';
import { RequirementRepository } from '../repositories/requirement.repository';
import { RequirementResponseRepository } from '../repositories/requirement-response.repository';
import { CreateResponseDto } from '../dto/create-requirement-response.dto';

export interface RequirementActor { userId: string; canModerate: boolean; }

@Injectable()
export class RequirementResponseService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly audit: AuditWriter,
    private readonly listings: ListingService,
    private readonly requirements: RequirementRepository,
    private readonly repo: RequirementResponseRepository,
  ) {}

  /** A seller submits a quote on someone else's OPEN requirement. */
  async submit(tenantId: string, sellerUserId: string, requirementId: string, idemKey: string, dto: CreateResponseDto) {
    return this.idem.remember(idemKey, sellerUserId, 'requirements.quote', () =>
      timed(this.metrics, 'requirements.quote', { tenant: tenantId }, async () => {
        const req = await this.requirements.getById(tenantId, requirementId);
        if (!req) throw new RequirementNotFoundError(requirementId);
        if (!isAcceptingResponses(req.status)) throw new RequirementNotOpenError(req.status);
        if (req.buyerUserId === sellerUserId) throw new SellerIsBuyerError();
        // a quote that names a listing must name the seller's OWN published listing
        if (dto.listingId) {
          const l: any = await this.listings.getById(tenantId, dto.listingId);
          if (!l || l.status !== 'published') throw new InvalidResponseError('listing not found or not published');
          if (l.sellerUserId !== sellerUserId) throw new InvalidResponseError('you can only quote your own listing');
        }
        const response = RequirementResponse.submit({
          id: uuidv7(), requirementId, tenantId, sellerUserId, listingId: dto.listingId ?? null,
          quotedPriceMinor: BigInt(dto.quotedPriceMinor), quantity: dto.quantity,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null, message: dto.message ?? null,
        });
        return this.uow.run(tenantId, async (tx) => {
          const inserted = await this.repo.insert(tx, response);
          if (!inserted) throw new DuplicateResponseError();
          const p = response.toProps();
          await this.flush(tx, tenantId, p.id, response.pullEvents());
          return this.serialize(p);
        }, { userId: sellerUserId });
      }));
  }

  /** Buyer shortlists a quote (and the requirement moves to partially_matched). */
  async shortlist(tenantId: string, actor: RequirementActor, responseId: string) {
    return this.buyerAction(tenantId, actor, responseId, 'shortlist', (resp) => resp.shortlist());
  }
  /** Buyer rejects a quote, or the quote's seller withdraws it. */
  async reject(tenantId: string, actor: RequirementActor, responseId: string) {
    return this.uow.run(tenantId, async (tx) => {
      const resp = await this.repo.getForUpdate(tx, tenantId, responseId);
      if (!resp) throw new ResponseNotFoundError(responseId);
      const req = await this.requirements.getForUpdate(tx, tenantId, resp.requirementId);
      if (!req) throw new RequirementNotFoundError(resp.requirementId);
      const isSellerOwner = resp.sellerUserId === actor.userId;
      const isBuyer = req.buyerUserId === actor.userId;
      if (!actor.canModerate && !isSellerOwner && !isBuyer) throw new RequirementForbiddenError();
      resp.reject();
      await this.repo.update(tx, resp);
      await this.flush(tx, tenantId, responseId, resp.pullEvents());
      return this.serialize(resp.toProps());
    }, { userId: actor.userId });
  }

  /** Buyer accepts a quote → the requirement is FULFILLED and requirements.quote_accepted is emitted
   *  (orders creates the order downstream). Requires the quote's listing to still be purchasable so
   *  the downstream order will succeed. */
  async accept(tenantId: string, actor: RequirementActor, responseId: string, ip: string | null) {
    return timed(this.metrics, 'requirements.accept', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const resp = await this.repo.getForUpdate(tx, tenantId, responseId);
        if (!resp) throw new ResponseNotFoundError(responseId);
        const req = await this.requirements.getForUpdate(tx, tenantId, resp.requirementId);
        if (!req) throw new RequirementNotFoundError(resp.requirementId);
        if (!actor.canModerate && req.buyerUserId !== actor.userId) throw new RequirementForbiddenError('only the buyer may accept a quote');
        if (!resp.listingId) throw new ResponseNotAcceptableError();
        const l: any = await this.listings.getById(tenantId, resp.listingId);
        if (!l || l.status !== 'published') throw new ResponseNotAcceptableError();

        resp.accept(req.buyerUserId, new Date());     // → accepted (+ quote_accepted event with order inputs)
        req.fulfill(resp.id);                          // → fulfilled
        await this.repo.update(tx, resp);
        await this.requirements.update(tx, req);
        await this.audit.write(tx, { tenantId, actorUserId: actor.userId, action: 'requirement.quote_accepted', entityType: 'requirement_response', entityId: responseId, newValue: { requirementId: req.id, sellerUserId: resp.sellerUserId }, ip });
        await this.flush(tx, tenantId, responseId, resp.pullEvents());
        await this.flushReq(tx, tenantId, req.id, req.pullEvents());
        return this.serialize(resp.toProps());
      }, { userId: actor.userId }));
  }

  /** Worker job: lapse a quote past valid_until. Idempotent (skips non-live). */
  async expireResponse(tenantId: string, responseId: string): Promise<void> {
    await this.uow.run(tenantId, async (tx) => {
      const resp = await this.repo.getForUpdate(tx, tenantId, responseId);
      if (!resp || !isLive(resp.status)) return;
      const vu = resp.validUntil;
      if (!vu || vu.getTime() >= Date.now()) return;
      resp.expire();
      await this.repo.update(tx, resp);
      await this.flush(tx, tenantId, responseId, resp.pullEvents());
    }, { userId: 'system' });
  }

  async getById(tenantId: string, actor: RequirementActor, responseId: string) {
    const resp = await this.repo.getById(tenantId, responseId);
    if (!resp) throw new ResponseNotFoundError(responseId);
    const req = await this.requirements.getById(tenantId, resp.requirementId);
    const isBuyer = req?.buyerUserId === actor.userId;
    if (!actor.canModerate && !isBuyer && resp.sellerUserId !== actor.userId) throw new RequirementForbiddenError();
    return this.serialize(resp.toProps());
  }

  /** Quotes on a requirement: the buyer (or moderator) sees all; a seller sees only their own. */
  async listForRequirement(tenantId: string, actor: RequirementActor, requirementId: string, q: { status?: string; cursor?: { c: string; id: string }; limit: number }) {
    const req = await this.requirements.getById(tenantId, requirementId);
    if (!req) throw new RequirementNotFoundError(requirementId);
    const isBuyer = actor.canModerate || req.buyerUserId === actor.userId;
    let rows = await this.repo.listForRequirement(tenantId, requirementId, { status: q.status, cursor: q.cursor, limit: q.limit });
    if (!isBuyer) rows = rows.filter((r) => r.sellerUserId === actor.userId);   // sellers never see competitors' quotes
    const items = rows.map((r) => this.serialize(r.toProps()));
    const last = items[items.length - 1];
    const nextCursor = isBuyer && items.length === q.limit && last ? Buffer.from(`${(last as any).createdAt.toISOString?.() ?? last.createdAt}|${last.id}`).toString('base64') : null;
    return { items, nextCursor };
  }

  private async buyerAction(tenantId: string, actor: RequirementActor, responseId: string, action: string, mutate: (resp: RequirementResponse) => void) {
    return timed(this.metrics, `requirements.${action}`, { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const resp = await this.repo.getForUpdate(tx, tenantId, responseId);
        if (!resp) throw new ResponseNotFoundError(responseId);
        const req = await this.requirements.getForUpdate(tx, tenantId, resp.requirementId);
        if (!req) throw new RequirementNotFoundError(resp.requirementId);
        if (!actor.canModerate && req.buyerUserId !== actor.userId) throw new RequirementForbiddenError('only the buyer may do this');
        mutate(resp);
        req.markPartiallyMatched();
        await this.repo.update(tx, resp);
        await this.requirements.update(tx, req);
        await this.flush(tx, tenantId, responseId, resp.pullEvents());
        await this.flushReq(tx, tenantId, req.id, req.pullEvents());
        return this.serialize(resp.toProps());
      }, { userId: actor.userId }));
  }

  private serialize(p: ReturnType<RequirementResponse['toProps']>) {
    return { id: p.id, requirementId: p.requirementId, sellerUserId: p.sellerUserId, listingId: p.listingId,
      quotedPriceMinor: p.quotedPriceMinor.toString(), quantity: p.quantity, validUntil: p.validUntil, message: p.message, status: p.status, createdAt: p.createdAt };
  }
  private async flush(tx: TxContext, tenantId: string, responseId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'requirement_response', aggregateId: responseId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
  private async flushReq(tx: TxContext, tenantId: string, requirementId: string, events: DomainEvent[]) {
    for (const e of events) await this.outbox.write(tx, { tenantId, aggregateType: 'requirement', aggregateId: requirementId, eventType: e.type, payload: { v: 1, ...e.payload } });
  }
}
