// modules/orders/services/cart-item.service.ts
// Canonical cart-item use-cases (add / update qty / remove / clear / list). Each item is validated against
// the LIVE listing via ListingService (cross-module public API, Law 11) — purchasable + in stock — and
// the price is SNAPSHOT at add time for drift detection. The cart is always the caller's OWN active cart,
// resolved server-side (anti-IDOR — no cart_id from the client). One ACID tx per write (UoW). CartService
// delegates its item mutations here so there's a single implementation (consolidation).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { ListingService } from '../../listings/services/listing.service';
import { CartRepository } from '../repositories/cart.repository';
import { CartItemRepository } from '../repositories/cart-item.repository';
import { ListingNotPurchasableError, InsufficientListingStockError, CartNotFoundError } from '../domain/orders.errors';
import { AddToCartDto } from '../dto/create-cart-item.dto';

@Injectable()
export class CartItemService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly listings: ListingService,
    private readonly carts: CartRepository,
    private readonly items: CartItemRepository,
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
      await this.items.upsert(tx, cartId, dto.listingId, dto.quantity, BigInt(l.priceMinor));
    }, { userId });
    this.metrics.inc('orders.cart_add', { tenant: tenantId });
    return { ok: true };
  }

  async updateItem(tenantId: string, userId: string, listingId: string, quantity: number) {
    await this.assertPurchasable(tenantId, listingId, quantity);
    await this.uow.run(tenantId, async (tx) => {
      const cartId = await this.carts.activeIdForUpdate(tx, tenantId, userId);
      if (!cartId) throw new CartNotFoundError();
      const n = await this.items.setQty(tx, cartId, listingId, quantity);
      if (n === 0) throw new CartNotFoundError();
    }, { userId });
    return { ok: true };
  }

  async removeItem(tenantId: string, userId: string, listingId: string) {
    await this.uow.run(tenantId, async (tx) => {
      const cartId = await this.carts.activeIdForUpdate(tx, tenantId, userId);
      if (cartId) await this.items.remove(tx, cartId, listingId);
    }, { userId });
    return { ok: true };
  }

  async clear(tenantId: string, userId: string) {
    await this.uow.run(tenantId, async (tx) => { const id = await this.carts.activeIdForUpdate(tx, tenantId, userId); if (id) await this.items.clear(tx, id); }, { userId });
    return { ok: true };
  }

  /** Raw lines of the caller's active cart (replica). The composite priced view is CartService.getCart. */
  async listItems(tenantId: string, userId: string) {
    return timed(this.metrics, 'orders.cart_items', { tenant: tenantId }, async () => {
      const cartId = await this.carts.activeId(tenantId, userId);
      if (!cartId) return { items: [] as Array<Record<string, unknown>> };
      const rows = await this.items.listByCart(tenantId, cartId);
      return { items: rows.map((r) => ({ listingId: r.listing_id, quantity: Number(r.quantity), addedPriceMinor: String(r.added_price_minor) })) };
    });
  }
}
