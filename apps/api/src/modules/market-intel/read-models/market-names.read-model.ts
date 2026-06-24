// modules/market-intel/read-models/market-names.read-model.ts · catalogue-name resolution for market reads.
// mandi_prices/price_predictions carry product/grade/region by UUID only; the client needs human names. This
// read model resolves a BOUNDED set of ids (those already present in a pulse/price page — never an unbounded
// scan) to default names from the GLOBAL master tables (products, attribute_options, admin_regions) on the
// replica (CQRS, Law 12). Tenant context applies (a tenant-private product still resolves under RLS; platform
// master rows have tenant_id NULL and pass the policy). Pure merge logic is unit-tested separately.
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';

/** PURE: collect the distinct, non-null ids referenced by a column across rows (bounded by the page size). */
export function distinctIds<T>(rows: T[], pick: (r: T) => string | null | undefined): string[] {
  const set = new Set<string>();
  for (const r of rows) { const v = pick(r); if (v) set.add(v); }
  return [...set];
}

@Injectable()
export class MarketNamesReadModel {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  private async nameMap(tenantId: string, table: string, ids: string[]): Promise<Record<string, string>> {
    if (ids.length === 0) return {};
    const r = await this.replica.forTenant(tenantId).query<{ id: string; default_name: string }>(
      `SELECT id, default_name FROM ${table} WHERE id = ANY($1)`, [ids]);
    const out: Record<string, string> = {};
    for (const row of r.rows) out[row.id] = row.default_name;
    return out;
  }

  /** Resolve the product/grade/region names referenced by the given rows. */
  async resolve(tenantId: string, rows: { productId?: string | null; gradeOptionId?: string | null; regionId?: string | null }[]) {
    const [products, grades, regions] = await Promise.all([
      this.nameMap(tenantId, 'products', distinctIds(rows, (r) => r.productId)),
      this.nameMap(tenantId, 'attribute_options', distinctIds(rows, (r) => r.gradeOptionId)),
      this.nameMap(tenantId, 'admin_regions', distinctIds(rows, (r) => r.regionId)),
    ]);
    return { products, grades, regions };
  }
}

/** PURE: attach resolved names onto a row JSON (no I/O). Unknown id → null name (degrade, never throw). */
export function withNames<T extends { productId?: string | null; gradeOptionId?: string | null; regionId?: string | null }>(
  row: T, maps: { products: Record<string, string>; grades: Record<string, string>; regions: Record<string, string> },
): T & { productName: string | null; gradeName: string | null; regionName: string | null } {
  return {
    ...row,
    productName: row.productId ? maps.products[row.productId] ?? null : null,
    gradeName: row.gradeOptionId ? maps.grades[row.gradeOptionId] ?? null : null,
    regionName: row.regionId ? maps.regions[row.regionId] ?? null : null,
  };
}
