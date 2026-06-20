// modules/catalogue/bulk/product-bulk-applier.ts · the catalogue's plug-in for the core bulk-import platform.
// Maps one CSV row → CreateProductDto and applies it through the existing ProductService (so every row gets the
// SAME validation, quota, tenant-scoping, outbox + idempotency as a single API create — no parallel write path,
// Law 1/2/3). Lives in catalogue (owns products); registered into the global BulkApplierRegistry at module init.
import { Injectable } from '@nestjs/common';
import { BulkRowApplier, BulkApplyContext } from '../../../core/bulk/bulk-applier.registry';
import { ProductService } from '../services/product.service';
import { CreateProductSchema } from '../dto/create-product.dto';

const num = (v: string | undefined) => (v != null && v !== '' ? Number(v) : undefined);
const bool = (v: string | undefined) => (v != null && v !== '' ? /^(true|1|yes|y)$/i.test(v) : undefined);

@Injectable()
export class ProductBulkApplier implements BulkRowApplier {
  readonly importType = 'products';
  readonly requiredColumns = ['categoryId', 'defaultName', 'defaultUnit'];

  constructor(private readonly products: ProductService) {}

  async applyRow(ctx: BulkApplyContext, rowIdemKey: string, row: Record<string, string>): Promise<{ id?: string }> {
    // Build a clean object (only known fields) then validate with the SAME strict schema the API uses —
    // a bad row throws a zod error the processor records as a per-row failure (the rest of the file continues).
    const candidate: Record<string, unknown> = {
      categoryId: row.categoryId, defaultName: row.defaultName, defaultUnit: row.defaultUnit,
    };
    if (row.code) candidate.code = row.code;
    if (row.brandId) candidate.brandId = row.brandId;
    if (row.hsnCode) candidate.hsnCode = row.hsnCode;
    const gst = num(row.gstRatePct); if (gst !== undefined) candidate.gstRatePct = gst;
    const shelf = num(row.shelfLifeDays); if (shelf !== undefined) candidate.shelfLifeDays = shelf;
    const perish = bool(row.isPerishable); if (perish !== undefined) candidate.isPerishable = perish;

    const dto = CreateProductSchema.parse(candidate);             // throws on invalid row → recorded as row error
    return this.products.create(ctx.tenantId, ctx.actorUserId, rowIdemKey, dto);
  }
}
