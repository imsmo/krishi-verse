// modules/buyer/domain/saved-item.entity.ts · a buyer's polymorphic favourite (saved_items, 0015).
// Pure domain: the only rule is that the entity_type is one the catalogue allows (matches the DB comment).
// Ownership (user_id) is set by the service from the token — never by the client — so there is no IDOR here.
import { InvalidSavedEntityTypeError } from './saved.errors';

// 'tip' = a saved knowledge-hub content item (the farmer tip wishlist, API-W12).
export const SAVED_ENTITY_TYPES = ['listing', 'product', 'seller', 'worker', 'course', 'tip'] as const;
export type SavedEntityType = (typeof SAVED_ENTITY_TYPES)[number];

export function assertSavedEntityType(t: string): SavedEntityType {
  if (!SAVED_ENTITY_TYPES.includes(t as SavedEntityType)) throw new InvalidSavedEntityTypeError(t);
  return t as SavedEntityType;
}
