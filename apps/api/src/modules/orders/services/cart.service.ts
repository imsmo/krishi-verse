// modules/orders/services/cart.service.ts · the buyer's cart. Validates each item against the
// LIVE listing via ListingService (cross-module public API, Law 11) — purchasable + in stock.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { ListingService } from '../../listings/services/listing.service';
import { CartRepository } from '../repositories/cart.repository';
import { ListingNotPurchasableError, InsufficientListingStockError, CartNotFoundError } from '../domain/orders.errors';
import { AddToCartDto } from '../dto/create-cart-item.dto';

@Injectable()
export class CartService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly listings: ListingService,
    private readonly carts: CartRepository,
  ) {}

  private async assertPurchasable(tenantId: string, listingId: string, qty: number) {
    const l: any = await this.listings.getById(tenantId, listingId);
    if (!l || l.status !== 'published') throw new ListingNotPurchasableError(listingId);
    if (Number(l.quantityAvailable) < qty) throw new InsufficientListingStockError(listingId, qty, Number(l.quantityAvailable));
    return l;
  }

  async addItem(tenantId: string, userId: string, dto: AddToCartDto) {
    const l = await this.assertPurchasable(tenantId, dto.listingId, dto.quantity);
    await this.uow.run(tenantId, async (tx) => {
      const cartId = await this.carts.getOrCreateActiveId(tx, tenantId, userId);
      await this.carts.upsertItem(tx, cartId, dto.listingId, dto.quantity, BigInt(l.priceMinor));
    }, { userId });
    this.metrics.inc('orders.cart_add', { tenant: tenantId });
    return { ok: true };
  }
  async updateItem(tenantId: string, userId: string, listingId: string, quantity: number) {
    await this.assertPurchasable(tenantId, listingId, quantity);
    await this.uow.run(tenantId, async (tx) => {
      const cartId = await this.carts.activeIdForUpdate(tx, tenantId, userId);
      if (!cartId) throw new CartNotFoundError();
      const n = await this.carts.setItemQty(tx, cartId, listingId, quantity);
      if (n === 0) throw new CartNotFoundError();
    }, { userId });
    return { ok: true };
  }
  async removeItem(tenantId: string, userId: string, listingId: string) {
    await this.uow.run(tenantId, async (tx) => {
      const cartId = await this.carts.activeIdForUpdate(tx, tenantId, userId);
      if (cartId) await this.carts.removeItem(tx, cartId, listingId);
    }, { userId });
    return { ok: true };
  }
  async clear(tenantId: string, userId: string) {
    await this.uow.run(tenantId, async (tx) => { const id = await this.carts.activeIdForUpdate(tx, tenantId, userId); if (id) await this.carts.clear(tx, id); }, { userId });
    return { ok: true };
  }
  /** Cart view with the CURRENT listing snapshot + a price-drift flag. */
  async getCart(tenantId: string, userId: string) {
    return timed(this.metrics, 'orders.cart_get', { tenant: tenantId }, async () => {
      const cartId = await this.carts.activeId(tenantId, userId);
      if (!cartId) return { items: [], subtotalMinor: '0' };
      const rows = await this.carts.items(tenantId, cartId);
      let subtotal = 0n;
      const items: Array<Record<string, unknown>> = [];
      for (const r of rows) {
        const l: any = await this.listings.getById(tenantId, r.listing_id);
        const qty = Number(r.quantity);
        const current = l ? BigInt(l.priceMinor) : BigInt(r.added_price_minor);
        const line = (current * BigInt(Math.round(qty * 1000))) / 1000n;
        subtotal += line;
        items.push({ listingId: r.listing_id, title: l?.title ?? null, quantity: qty, unitPriceMinor: current.toString(),
          lineTotalMinor: line.toString(), priceChanged: l ? BigInt(l.priceMinor) !== BigInt(r.added_price_minor) : false,
          available: l ? Number(l.quantityAvailable) : 0, purchasable: !!l && l.status === 'published' });
      }
      return { items, subtotalMinor: subtotal.toString() };
    });
  }
}
