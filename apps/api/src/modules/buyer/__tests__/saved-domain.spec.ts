// API-W5 pure-domain test for the saved-item entity-type guard (node-port lane). The SQL upsert/list +
// owner-scoping run against real Postgres in the integration suite; this asserts the pure catalogue guard.
import { assertSavedEntityType, SAVED_ENTITY_TYPES } from '../domain/saved-item.entity';
import { InvalidSavedEntityTypeError } from '../domain/saved.errors';

describe('assertSavedEntityType', () => {
  it('accepts every allowed entity type', () => {
    for (const t of SAVED_ENTITY_TYPES) expect(assertSavedEntityType(t)).toBe(t);
  });
  it('rejects an unknown entity type', () => {
    expect(() => assertSavedEntityType('order')).toThrow(InvalidSavedEntityTypeError);
    expect(() => assertSavedEntityType('')).toThrow(InvalidSavedEntityTypeError);
  });
});
