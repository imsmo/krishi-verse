// core/bulk/bulk-applier.registry.ts · the extension point. core/bulk is generic plumbing (no business logic);
// each domain module registers a BulkRowApplier for the entity it owns (e.g. catalogue registers 'products').
// The processor resolves the applier by importType and applies each CSV row through it. Mirrors the outbox
// handler-registry pattern — modules register in onModuleInit, so core never imports a module.
export interface BulkApplyContext { tenantId: string; actorUserId: string; }

export interface BulkRowApplier {
  /** The import_type this applier handles (e.g. 'products'). */
  readonly importType: string;
  /** Columns that MUST be present in the CSV header (validated before any row runs — fail closed). */
  readonly requiredColumns: string[];
  /**
   * Apply ONE row. MUST be idempotent w.r.t. rowIdemKey (the processor passes a deterministic per-row key so a
   * resumed/retried import never double-creates). Throw a typed error to mark the row failed; return the new id
   * on success. Money/tenant rules are enforced by the underlying module service the applier delegates to.
   */
  applyRow(ctx: BulkApplyContext, rowIdemKey: string, row: Record<string, string>): Promise<{ id?: string }>;
}

export class BulkApplierRegistry {
  private readonly byType = new Map<string, BulkRowApplier>();
  register(applier: BulkRowApplier): void {
    if (this.byType.has(applier.importType)) throw new Error(`duplicate bulk applier for "${applier.importType}"`);
    this.byType.set(applier.importType, applier);
  }
  get(importType: string): BulkRowApplier | undefined { return this.byType.get(importType); }
  has(importType: string): boolean { return this.byType.has(importType); }
  types(): string[] { return [...this.byType.keys()]; }
}
export const BULK_APPLIER_REGISTRY = Symbol('BULK_APPLIER_REGISTRY');
