// modules/catalogue/domain/product-batch.entity.ts
// Pharma/agri-input store inventory batch (expiry tracking, FIFO consume, recalls — PRD §9.10).
// Tenant-scoped. Money (mrp) is bigint minor units. Quantity is decimal (kg/litre/units).
import { InvalidBatchError, InsufficientBatchQtyError } from './catalogue.errors';
import type { DomainEvent } from './catalogue.events';

export interface ProductBatchProps {
  id: string; tenantId: string; productId: string; sellerUserId: string | null; batchNo: string;
  mfgDate: string | null; expiryDate: string | null; mrpMinor: bigint | null; currencyCode: string;
  qtyReceived: number; qtyRemaining: number; unitCode: string; isRecalled: boolean; recallReason: string | null;
}

export class ProductBatch {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: ProductBatchProps) {}

  static create(input: Omit<ProductBatchProps, 'qtyRemaining' | 'isRecalled' | 'recallReason'>): ProductBatch {
    if (!input.batchNo) throw new InvalidBatchError('batch_no is required');
    if (input.qtyReceived <= 0) throw new InvalidBatchError('qty_received must be > 0');
    if (input.expiryDate && input.mfgDate && input.expiryDate < input.mfgDate) throw new InvalidBatchError('expiry before mfg date');
    if (input.mrpMinor != null && input.mrpMinor < 0n) throw new InvalidBatchError('mrp must be >= 0');
    const b = new ProductBatch({ ...input, qtyRemaining: input.qtyReceived, isRecalled: false, recallReason: null });
    b.events.push({ type: 'catalogue.batch_created', payload: { batchId: b.props.id, tenantId: input.tenantId, productId: input.productId } });
    return b;
  }
  static rehydrate(props: ProductBatchProps): ProductBatch { return new ProductBatch(props); }

  get id() { return this.props.id; }
  toProps(): Readonly<ProductBatchProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  consume(qty: number): void {
    if (this.props.isRecalled) throw new InvalidBatchError('batch is recalled');
    if (qty <= 0) throw new InvalidBatchError('qty must be > 0');
    if (qty > this.props.qtyRemaining) throw new InsufficientBatchQtyError(qty, this.props.qtyRemaining);
    this.props.qtyRemaining -= qty;
  }
  restock(qty: number): void { if (qty <= 0) throw new InvalidBatchError('qty must be > 0'); this.props.qtyRemaining = Math.min(this.props.qtyReceived, this.props.qtyRemaining + qty); }
  recall(reason: string): void {
    this.props.isRecalled = true; this.props.recallReason = reason;
    this.events.push({ type: 'catalogue.batch_recalled', payload: { batchId: this.props.id, productId: this.props.productId, reason } });
  }
  isExpired(asOf: Date = new Date()): boolean { return !!this.props.expiryDate && new Date(this.props.expiryDate) < asOf; }
}
