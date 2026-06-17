// modules/catalogue/__tests__/product-batch.spec.ts · inventory invariants (consume/recall/expiry).
import { ProductBatch } from '../domain/product-batch.entity';
import { InvalidBatchError, InsufficientBatchQtyError } from '../domain/catalogue.errors';
const base = { id: 'b1', tenantId: 't1', productId: 'p1', sellerUserId: 'u1', batchNo: 'B-100', mfgDate: '2026-01-01', expiryDate: '2027-01-01', mrpMinor: 19900n, currencyCode: 'INR', qtyReceived: 100, unitCode: 'unit' };

describe('ProductBatch', () => {
  it('create sets qty_remaining = received and emits batch_created', () => {
    const b = ProductBatch.create({ ...base });
    expect(b.toProps().qtyRemaining).toBe(100);
    expect(b.pullEvents().map((e) => e.type)).toContain('catalogue.batch_created');
  });
  it('rejects expiry before mfg + non-positive qty', () => {
    expect(() => ProductBatch.create({ ...base, expiryDate: '2025-01-01' })).toThrow(InvalidBatchError);
    expect(() => ProductBatch.create({ ...base, qtyReceived: 0 })).toThrow(InvalidBatchError);
  });
  it('consume reduces remaining, prevents oversell, blocked after recall', () => {
    const b = ProductBatch.create({ ...base, qtyReceived: 10 }); b.pullEvents();
    expect(() => b.consume(11)).toThrow(InsufficientBatchQtyError);
    b.consume(10); expect(b.toProps().qtyRemaining).toBe(0);
    const b2 = ProductBatch.create({ ...base }); b2.recall('contamination');
    expect(() => b2.consume(1)).toThrow(InvalidBatchError);
    expect(b2.pullEvents().map((e) => e.type)).toContain('catalogue.batch_recalled');
  });
  it('isExpired by date', () => {
    expect(ProductBatch.create({ ...base, mfgDate: null, expiryDate: '2020-01-01' }).isExpired()).toBe(true);
    expect(ProductBatch.create({ ...base, expiryDate: '2999-01-01' }).isExpired()).toBe(false);
  });
});
