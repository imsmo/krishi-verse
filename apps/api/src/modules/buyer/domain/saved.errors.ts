// modules/buyer/domain/saved.errors.ts · typed errors, stable codes → HTTP.
import { DomainError } from '../../../shared/errors/app-error';

export class InvalidSavedEntityTypeError extends DomainError {
  constructor(t: string) { super('SAVED_ENTITY_TYPE_INVALID', `Cannot save entity type '${t}'`, 400, { entityType: t }); }
}
export class SavedSearchNotFoundError extends DomainError {
  constructor(id: string) { super('SAVED_SEARCH_NOT_FOUND', `Saved search ${id} not found`, 404, { id }); }
}
