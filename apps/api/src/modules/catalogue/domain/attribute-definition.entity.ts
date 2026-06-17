// modules/catalogue/domain/attribute-definition.entity.ts
// A typed dynamic attribute (EAV done right). Read model + value VALIDATION so product/
// listing attribute values are checked against the definition (type, min/max, regex, options).
import { AttributeValidationError } from './catalogue.errors';

export type DataType = 'text' | 'number' | 'decimal' | 'bool' | 'date' | 'option' | 'multi_option' | 'range' | 'file';
export interface AttributeValidation { min?: number; max?: number; regex?: string; maxLen?: number }
export interface AttributeDefinitionProps {
  id: string; code: string; defaultName: string; dataType: DataType; unitCode: string | null;
  validation: AttributeValidation; isActive: boolean;
}

export class AttributeDefinition {
  constructor(readonly props: AttributeDefinitionProps) {}
  get id() { return this.props.id; }
  get code() { return this.props.code; }

  /** Validate a submitted value against this definition. Throws AttributeValidationError. */
  validate(value: unknown, allowedOptionIds?: ReadonlySet<string>): void {
    const v = this.props.validation ?? {};
    switch (this.props.dataType) {
      case 'text': {
        if (typeof value !== 'string') throw new AttributeValidationError(this.props.code, 'expected text');
        if (v.maxLen && value.length > v.maxLen) throw new AttributeValidationError(this.props.code, `max length ${v.maxLen}`);
        if (v.regex && !new RegExp(v.regex).test(value)) throw new AttributeValidationError(this.props.code, 'format mismatch');
        break;
      }
      case 'number': case 'decimal': case 'range': {
        if (typeof value !== 'number' || Number.isNaN(value)) throw new AttributeValidationError(this.props.code, 'expected number');
        if (v.min != null && value < v.min) throw new AttributeValidationError(this.props.code, `min ${v.min}`);
        if (v.max != null && value > v.max) throw new AttributeValidationError(this.props.code, `max ${v.max}`);
        break;
      }
      case 'bool': if (typeof value !== 'boolean') throw new AttributeValidationError(this.props.code, 'expected boolean'); break;
      case 'date': if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new AttributeValidationError(this.props.code, 'expected ISO date'); break;
      case 'option': case 'multi_option': {
        const ids = Array.isArray(value) ? value : [value];
        for (const id of ids) if (typeof id !== 'string' || (allowedOptionIds && !allowedOptionIds.has(id)))
          throw new AttributeValidationError(this.props.code, 'invalid option');
        break;
      }
      case 'file': if (typeof value !== 'string') throw new AttributeValidationError(this.props.code, 'expected media id'); break;
    }
  }
}
