// modules/catalogue/domain/category-attribute.entity.ts · the binding of an attribute to a category branch
// (inherits down the ltree tree): is it required, shown in search facets, shown on the card, and an optional
// CONDITIONAL ({if:{code:value},then:{required:[...]}}). Pure read model (GLOBAL master, no tenant_id — written
// in apps/admin-api, Law 11). `appliesWhen` + `conditionalRequired` are pure so the listing-create form logic can
// be unit-tested: e.g. "if organic=true then cert_body + cert_no become required".
export interface CategoryAttributeProps {
  id: string; categoryId: string; attributeId: string; isRequired: boolean; showInFilters: boolean;
  showOnCard: boolean; condition: unknown; sortOrder: number;
}

export class CategoryAttribute {
  constructor(readonly props: CategoryAttributeProps) {}
  get id(): string { return this.props.id; }

  private cond(): { ifClause: Record<string, unknown>; thenRequired: string[] } | null {
    const c = this.props.condition;
    if (c === null || typeof c !== 'object' || Array.isArray(c)) return null;
    const obj = c as Record<string, unknown>;
    const ifClause = (obj.if && typeof obj.if === 'object' && !Array.isArray(obj.if)) ? (obj.if as Record<string, unknown>) : {};
    const then = (obj.then && typeof obj.then === 'object' && !Array.isArray(obj.then)) ? (obj.then as Record<string, unknown>) : {};
    const thenRequired = Array.isArray(then.required) ? (then.required as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    return { ifClause, thenRequired };
  }

  /** True iff this binding's `if` clause matches the submitted attribute values (by code). No condition ⇒ true. */
  appliesWhen(valuesByCode: Record<string, unknown>): boolean {
    const c = this.cond();
    if (!c || Object.keys(c.ifClause).length === 0) return true;
    return Object.entries(c.ifClause).every(([code, want]) => valuesByCode[code] === want);
  }

  /** Extra attribute codes that become required when the condition matches (empty otherwise). */
  conditionalRequired(valuesByCode: Record<string, unknown>): string[] {
    const c = this.cond();
    if (!c) return [];
    return this.appliesWhen(valuesByCode) ? c.thenRequired : [];
  }

  toJSON() {
    return { id: this.props.id, categoryId: this.props.categoryId, attributeId: this.props.attributeId, isRequired: this.props.isRequired, showInFilters: this.props.showInFilters, showOnCard: this.props.showOnCard, condition: this.props.condition ?? null, sortOrder: this.props.sortOrder };
  }
}
