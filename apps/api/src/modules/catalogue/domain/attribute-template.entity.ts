// modules/catalogue/domain/attribute-template.entity.ts · a clonable per-crop preset (PRD §9.2 'templates'):
// an ordered set of attribute references + defaults a seller clones when creating a listing/product so they don't
// hand-pick every attribute. Pure read model (GLOBAL master, no tenant_id — written in apps/admin-api, Law 11).
// `payload` is bounded + shape-validated here so a malformed master row can never blow up the clone path.
import { AttributeTemplateInvalidError } from './catalogue.errors';

export const MAX_TEMPLATE_ITEMS = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AttributeTemplateItem { attributeId: string; required: boolean; defaultValue: string | number | boolean | null; sortOrder: number; }
export interface AttributeTemplateProps { id: string; code: string; defaultName: string; categoryId: string | null; payload: unknown; createdAt?: Date | null; }

export class AttributeTemplate {
  constructor(readonly props: AttributeTemplateProps) {}
  get id(): string { return this.props.id; }
  get code(): string { return this.props.code; }

  /** Validate + normalise the stored payload into the ordered items a client clones. Throws on a malformed row. */
  resolveItems(): AttributeTemplateItem[] {
    const p = this.props.payload;
    if (p === null || typeof p !== 'object' || Array.isArray(p)) throw new AttributeTemplateInvalidError(this.props.code, 'payload must be a JSON object');
    const rawItems = (p as Record<string, unknown>).items;
    if (!Array.isArray(rawItems)) throw new AttributeTemplateInvalidError(this.props.code, 'payload.items must be an array');
    if (rawItems.length > MAX_TEMPLATE_ITEMS) throw new AttributeTemplateInvalidError(this.props.code, `exceeds ${MAX_TEMPLATE_ITEMS} items`);
    const items: AttributeTemplateItem[] = rawItems.map((raw, i) => {
      const it = (raw ?? {}) as Record<string, unknown>;
      if (typeof it.attributeId !== 'string' || !UUID_RE.test(it.attributeId)) throw new AttributeTemplateInvalidError(this.props.code, `item ${i}: attributeId must be a uuid`);
      const dv = it.defaultValue;
      if (dv !== undefined && dv !== null && !['string', 'number', 'boolean'].includes(typeof dv)) throw new AttributeTemplateInvalidError(this.props.code, `item ${i}: defaultValue must be a primitive`);
      const so = typeof it.sortOrder === 'number' && Number.isInteger(it.sortOrder) ? it.sortOrder : (i + 1) * 10;
      return { attributeId: it.attributeId, required: it.required === true, defaultValue: (dv ?? null) as string | number | boolean | null, sortOrder: so };
    });
    return items.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  toJSON() { return { id: this.props.id, code: this.props.code, defaultName: this.props.defaultName, categoryId: this.props.categoryId ?? null, items: this.resolveItems() }; }
}
