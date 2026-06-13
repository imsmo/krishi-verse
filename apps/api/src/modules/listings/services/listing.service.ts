// modules/listings/services/listing.service.ts
// Application service for the listings aggregate. This is where the platform's
// non-negotiables come together for EVERY write:
//   • one ACID transaction on the tenant's shard (UnitOfWork) with RLS set
//   • domain events drained from the aggregate → outbox IN THE SAME TX (Law 4)
//   • idempotency on create (Law 3) · plan-quota enforcement · optimistic locking
//   • ENFORCED ownership/authorization (seller owns the listing, or admin moderates)
//   • structured metrics/timing on every use-case (observability)
// It never touches money tables directly — that is wallet-service's job (Law 2).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork, TxContext } from '../../../core/database/unit-of-work';
import { OUTBOX_WRITER, OutboxWriter } from '../../../core/outbox/outbox.writer';
import { QUOTA_SERVICE, QuotaService } from '../../../core/quota/quota.service';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../core/idempotency/idempotency.service';
import { CACHE_SERVICE, CacheService } from '../../../core/cache/cache.service';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { ForbiddenError } from '../../../shared/errors/app-error';
import { Listing, ListingDomainEvent } from '../domain/listing.entity';
import { ListingConcurrencyError } from '../domain/listing.errors';
import { PriceHistory } from '../domain/price-history.entity';
import { ListingAttribute, AttrValue } from '../domain/listing-attribute.entity';
import { ListingRepository } from '../repositories/listing.repository';
import { PriceHistoryRepository } from '../repositories/price-history.repository';
import { ListingAttributeRepository } from '../repositories/listing-attribute.repository';
import { ListingMediaRepository } from '../repositories/listing-media.repository';
import { CreateListingDto } from '../dto/create-listing.dto';

const QUOTA_METRIC = 'max_listings_month';
const cacheKey = (t: string, id: string) => `t:${t}:listing:${id}`;

/** The acting principal for a mutation: the seller, or an admin who may moderate. */
export interface ListingActor { userId: string; canModerate: boolean; }

@Injectable()
export class ListingService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(OUTBOX_WRITER) private readonly outbox: OutboxWriter,
    @Inject(QUOTA_SERVICE) private readonly quota: QuotaService,
    @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: ListingRepository,
    private readonly priceHistory: PriceHistoryRepository,
    private readonly attrs: ListingAttributeRepository,
    private readonly media: ListingMediaRepository,
  ) {}

  /** Drain aggregate events into the outbox within the same transaction. */
  private async flushEvents(tx: TxContext, tenantId: string, listingId: string, events: ListingDomainEvent[]) {
    for (const e of events) {
      await this.outbox.write(tx, {
        tenantId, aggregateType: 'listing', aggregateId: listingId,
        eventType: e.type, payload: { v: 1, ...e },
      });
    }
  }

  /** CREATE — idempotent, quota-enforced, atomic, event-emitting. */
  async create(tenantId: string, sellerUserId: string, idemKey: string, dto: CreateListingDto): Promise<{ id: string }> {
    return this.idem.remember(idemKey, sellerUserId, 'listings.create', () =>
      timed(this.metrics, 'listing.create', { tenant: tenantId }, async () => {
        await this.quota.assertWithinLimit(tenantId, QUOTA_METRIC);
        const id = uuidv7();
        const listing = Listing.create({
          id, tenantId, sellerUserId, productId: dto.productId, categoryId: dto.categoryId,
          title: dto.title, description: dto.description ?? null,
          quantityTotal: dto.quantityTotal, minOrderQty: dto.minOrderQty, unitCode: dto.unitCode,
          priceMinor: BigInt(dto.priceMinor), currencyCode: dto.currencyCode,
          organicClaim: dto.organicClaim, saleType: dto.saleType,
          pincode: dto.pincode ?? null, regionId: dto.regionId ?? null,
          lat: dto.lat ?? null, lng: dto.lng ?? null, visibility: dto.visibility,
          aiExtracted: false, publishAt: dto.publishAt ? new Date(dto.publishAt) : null,
          publishedAt: null, expiresAt: null,
        });
        const attrEntities = (dto.attributes ?? []).map((a) =>
          ListingAttribute.of({ id: uuidv7(), tenantId, listingId: id, attributeId: a.attributeId, value: toAttrValue(a) }));

        await this.uow.run(tenantId, async (tx) => {
          await this.repo.insert(tx, listing);
          if (attrEntities.length) await this.attrs.upsertMany(tx, attrEntities);
          if (dto.mediaIds?.length) await this.media.attach(tx, tenantId, id, dto.mediaIds);
          await this.quota.increment(tx, tenantId, QUOTA_METRIC, 1);
          await this.flushEvents(tx, tenantId, id, listing.pullEvents());
        }, { userId: sellerUserId });

        this.metrics.inc('listing.created', { tenant: tenantId });
        return { id };
      }));
  }

  /** PUBLISH — ownership-enforced, guarded transition; emits the searchable event. */
  async publish(tenantId: string, actor: ListingActor, id: string): Promise<void> {
    await timed(this.metrics, 'listing.publish', { tenant: tenantId }, async () => {
      await this.uow.run(tenantId, async (tx) => {
        const listing = await this.repo.getForUpdate(tx, tenantId, id);
        this.assertCanMutate(listing, actor);
        listing.publish();
        await this.repo.update(tx, listing);
        await this.flushEvents(tx, tenantId, id, listing.pullEvents());
      }, { userId: actor.userId });
      await this.cache.del(cacheKey(tenantId, id));
    });
  }

  /** CHANGE PRICE — ownership + optimistic-locked, writes price history, emits event. */
  async changePrice(tenantId: string, actor: ListingActor, id: string, newPriceMinor: bigint, expectedVersion: number): Promise<void> {
    await timed(this.metrics, 'listing.change_price', { tenant: tenantId }, async () => {
      await this.uow.run(tenantId, async (tx) => {
        const listing = await this.repo.getForUpdate(tx, tenantId, id);
        this.assertCanMutate(listing, actor);
        this.assertVersion(listing, expectedVersion);
        const old = listing.price.minor;
        listing.changePrice(newPriceMinor);
        await this.repo.update(tx, listing);
        if (old !== newPriceMinor) {
          await this.priceHistory.append(tx, PriceHistory.record({ id: uuidv7(), tenantId, listingId: id, oldPriceMinor: old, newPriceMinor, changedBy: actor.userId }));
        }
        await this.flushEvents(tx, tenantId, id, listing.pullEvents());
      }, { userId: actor.userId });
      await this.cache.del(cacheKey(tenantId, id));
    });
  }

  /** Reduce stock when an order/auction wins (system-initiated via event handlers). */
  async reduceStock(tenantId: string, id: string, qty: number): Promise<void> {
    await this.uow.run(tenantId, async (tx) => {
      const listing = await this.repo.getForUpdate(tx, tenantId, id);
      listing.reduceStock(qty);
      await this.repo.update(tx, listing);
      await this.flushEvents(tx, tenantId, id, listing.pullEvents());
    });
    await this.cache.del(cacheKey(tenantId, id));
  }

  async restock(tenantId: string, id: string, qty: number): Promise<void> {
    await this.uow.run(tenantId, async (tx) => {
      const listing = await this.repo.getForUpdate(tx, tenantId, id);
      listing.restock(qty);
      await this.repo.update(tx, listing);
      await this.flushEvents(tx, tenantId, id, listing.pullEvents());
    });
    await this.cache.del(cacheKey(tenantId, id));
  }

  /** READ — single listing, cache-aside off a replica (browse detail page). */
  async getById(tenantId: string, id: string) {
    return this.cache.wrap(cacheKey(tenantId, id), 300, async () => {
      const l = await this.repo.findById(tenantId, id);
      return l ? l.toProps() : null;
    });
  }

  /** Authorization: the seller owns it, OR the caller may moderate (admin). Else 403. */
  private assertCanMutate(listing: Listing, actor: ListingActor): void {
    if (actor.canModerate) return;
    if (listing.sellerUserId !== actor.userId) {
      throw new ForbiddenError('You can only modify your own listings',
        { listingId: listing.id });
    }
  }
  private assertVersion(listing: Listing, expected: number): void {
    if (listing.version !== expected) throw new ListingConcurrencyError(listing.id);
  }
}

function toAttrValue(a: any): AttrValue {
  switch (a.kind) {
    case 'text': return { kind: 'text', text: a.text };
    case 'number': return { kind: 'number', number: a.number };
    case 'bool': return { kind: 'bool', bool: a.bool };
    case 'date': return { kind: 'date', date: a.date };
    case 'option': return { kind: 'option', optionId: a.optionId };
    default: throw new Error('UNKNOWN_ATTR_KIND');
  }
}
