// modules/catalogue/domain/attribute-option.entity.ts · a dropdown value of an `option`/`multi_option` attribute
// (variety lists, grades). Pure read model in the tenant plane (GLOBAL master, no tenant_id — written in
// apps/admin-api, Law 11). The product/listing attribute-value validator checks a submitted optionId against the
// set of an attribute's active options (see AttributeDefinition.validate).
export interface AttributeOptionProps {
  id: string; attributeId: string; code: string; defaultName: string; sortOrder: number; isActive: boolean; createdAt?: Date | null;
}

export class AttributeOption {
  constructor(readonly props: AttributeOptionProps) {}
  get id(): string { return this.props.id; }
  get attributeId(): string { return this.props.attributeId; }
  toJSON() { return { id: this.props.id, attributeId: this.props.attributeId, code: this.props.code, defaultName: this.props.defaultName, sortOrder: this.props.sortOrder, isActive: this.props.isActive }; }
}
