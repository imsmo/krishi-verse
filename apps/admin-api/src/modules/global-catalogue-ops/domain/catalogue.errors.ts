// apps/admin-api/src/modules/global-catalogue-ops/domain/catalogue.errors.ts · typed errors → HTTP via
// HttpException subclasses with stable codes (mirrors the other ops modules). Covers the two registries this
// module owns: the lookup vocabularies (lookup_types/lookup_values) and the category tree (categories).
import { HttpException, HttpStatus } from '@nestjs/common';

class DomainHttpError extends HttpException {
  constructor(code: string, message: string, status: HttpStatus, detail: Record<string, unknown> = {}) {
    super({ code, message, ...detail }, status);
  }
}

/* ---------------- not-found (404 — never 403, no cross-entity enumeration leak) ---------------- */
export class LookupTypeNotFoundError extends DomainHttpError {
  constructor(typeCode: string) { super('LOOKUP_TYPE_NOT_FOUND', `lookup type '${typeCode}' not found`, HttpStatus.NOT_FOUND, { typeCode }); }
}
export class LookupValueNotFoundError extends DomainHttpError {
  constructor(id: string) { super('LOOKUP_VALUE_NOT_FOUND', `lookup value '${id}' not found`, HttpStatus.NOT_FOUND, { id }); }
}
export class CategoryNotFoundError extends DomainHttpError {
  constructor(id: string) { super('CATEGORY_NOT_FOUND', `category '${id}' not found`, HttpStatus.NOT_FOUND, { id }); }
}

/* ---------------- validation (422) ---------------- */
export class InvalidCatalogueInputError extends DomainHttpError {
  constructor(detail: string) { super('CATALOGUE_INPUT_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
export class CategoryDepthExceededError extends DomainHttpError {
  constructor(maxDepth: number) { super('CATEGORY_DEPTH_EXCEEDED', `category tree may not exceed depth ${maxDepth}`, HttpStatus.UNPROCESSABLE_ENTITY, { maxDepth }); }
}
export class CategoryCycleError extends DomainHttpError {
  constructor() { super('CATEGORY_CYCLE', 'a category cannot be moved under itself or one of its descendants', HttpStatus.UNPROCESSABLE_ENTITY); }
}
export class SubtreeTooLargeError extends DomainHttpError {
  constructor(count: number, max: number) { super('CATEGORY_SUBTREE_TOO_LARGE', `subtree of ${count} categories exceeds the ${max}-node move limit; reorganise in smaller steps`, HttpStatus.UNPROCESSABLE_ENTITY, { count, max }); }
}

/* ---------------- conflict (409) ---------------- */
export class DuplicateCatalogueCodeError extends DomainHttpError {
  constructor(kind: string, code: string) { super('CATALOGUE_CODE_EXISTS', `${kind} code '${code}' already exists`, HttpStatus.CONFLICT, { kind, code }); }
}
/** activate/deactivate is a no-op — the entity is already in the requested state. */
export class CatalogueAlreadyInStateError extends DomainHttpError {
  constructor(kind: string, isActive: boolean) { super('CATALOGUE_ALREADY_IN_STATE', `${kind} is already ${isActive ? 'active' : 'inactive'}`, HttpStatus.CONFLICT, { isActive }); }
}
export class ParentInactiveError extends DomainHttpError {
  constructor() { super('CATEGORY_PARENT_INACTIVE', 'the parent category is inactive', HttpStatus.CONFLICT); }
}
export class CategoryHasActiveChildrenError extends DomainHttpError {
  constructor(count: number) { super('CATEGORY_HAS_ACTIVE_CHILDREN', `cannot deactivate a category with ${count} active child categories; deactivate them first`, HttpStatus.CONFLICT, { activeChildren: count }); }
}
