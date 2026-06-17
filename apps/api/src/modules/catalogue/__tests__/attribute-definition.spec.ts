// modules/catalogue/__tests__/attribute-definition.spec.ts · typed value validation.
import { AttributeDefinition } from '../domain/attribute-definition.entity';
import { AttributeValidationError } from '../domain/catalogue.errors';
const def = (over: any) => new AttributeDefinition({ id: 'a', code: 'attr', defaultName: 'Attr', dataType: 'text', unitCode: null, validation: {}, isActive: true, ...over });

describe('AttributeDefinition.validate', () => {
  it('text: enforces maxLen + regex', () => {
    const d = def({ dataType: 'text', validation: { maxLen: 3, regex: '^[a-z]+$' } });
    expect(() => d.validate('abcd')).toThrow(AttributeValidationError);
    expect(() => d.validate('AB')).toThrow(AttributeValidationError);
    expect(() => d.validate('ab')).not.toThrow();
  });
  it('number: enforces min/max + type', () => {
    const d = def({ dataType: 'number', validation: { min: 0, max: 100 } });
    expect(() => d.validate(150)).toThrow(AttributeValidationError);
    expect(() => d.validate('5' as any)).toThrow(AttributeValidationError);
    expect(() => d.validate(50)).not.toThrow();
  });
  it('option: must be in the allowed set', () => {
    const d = def({ dataType: 'option' });
    expect(() => d.validate('opt-x', new Set(['opt-a']))).toThrow(AttributeValidationError);
    expect(() => d.validate('opt-a', new Set(['opt-a']))).not.toThrow();
  });
  it('bool/date type checks', () => {
    expect(() => def({ dataType: 'bool' }).validate('yes' as any)).toThrow(AttributeValidationError);
    expect(() => def({ dataType: 'date' }).validate('not-a-date')).toThrow(AttributeValidationError);
    expect(() => def({ dataType: 'date' }).validate('2026-01-01')).not.toThrow();
  });
});
