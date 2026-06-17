// modules/catalogue/domain/product.entity.ts
// Product master ("the thing"), distinct from a listing ("the offer"). A tenant-private
// product carries tenant_id (RLS-scoped); platform-master products have tenant_id NULL
// and are managed in admin-api. Pure domain — invariants only, no I/O.
import { InvalidProductError } from './catalogue.errors';
import type { DomainEvent } from './catalogue.events';

export interface ProductProps {
  id: string; categoryId: string; code: string | null; defaultName: string; brandId: string | null;
  defaultUnit: string; gstRatePct: number | null; hsnCode: string | null; isPerishable: boolean;
  shelfLifeDays: number | null; tenantId: string | null; isActive: boolean;
}

export class Product {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: ProductProps) {}

  /** Create a TENANT-PRIVATE product (tenant_id is always set here; platform master is admin-api). */
  static create(input: Omit<ProductProps, 'isActive'> & { tenantId: string }): Product {
    if (!input.defaultName || input.defaultName.trim().length < 2) throw new InvalidProductError('name is required');
    if (!input.categoryId) throw new InvalidProductError('category is required');
    if (!input.defaultUnit) throw new InvalidProductError('default unit is required');
    if (input.gstRatePct != null && (input.gstRatePct < 0 || input.gstRatePct > 100)) throw new InvalidProductError('gst_rate_pct out of range');
    if (input.shelfLifeDays != null && input.shelfLifeDays < 0) throw new InvalidProductError('shelf_life_days must be >= 0');
    const p = new Product({ ...input, isActive: true });
    p.events.push({ type: 'catalogue.product_created', payload: { productId: p.props.id, tenantId: input.tenantId } });
    return p;
  }
  static rehydrate(props: ProductProps): Product { return new Product(props); }

  get id() { return this.props.id; }
  get tenantId() { return this.props.tenantId; }
  get isActive() { return this.props.isActive; }
  toProps(): Readonly<ProductProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  update(patch: Partial<Pick<ProductProps, 'defaultName' | 'brandId' | 'defaultUnit' | 'gstRatePct' | 'hsnCode' | 'isPerishable' | 'shelfLifeDays' | 'categoryId'>>): void {
    if (patch.defaultName !== undefined && patch.defaultName.trim().length < 2) throw new InvalidProductError('name is required');
    if (patch.gstRatePct != null && (patch.gstRatePct < 0 || patch.gstRatePct > 100)) throw new InvalidProductError('gst_rate_pct out of range');
    Object.assign(this.props, patch);
    this.events.push({ type: 'catalogue.product_updated', payload: { productId: this.props.id } });
  }
  deactivate(): void {
    if (!this.props.isActive) return;
    this.props.isActive = false;
    this.events.push({ type: 'catalogue.product_deactivated', payload: { productId: this.props.id } });
  }
  activate(): void { this.props.isActive = true; }
}
