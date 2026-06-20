// modules/cms/domain/cms.errors.ts · typed errors, stable codes → HTTP.
import { DomainError } from '../../../shared/errors/app-error';

export class PageNotFoundError extends DomainError { constructor(id: string) { super('CMS_PAGE_NOT_FOUND', `Page ${id} not found`, 404, { id }); } }
export class BannerNotFoundError extends DomainError { constructor(id: string) { super('CMS_BANNER_NOT_FOUND', `Banner ${id} not found`, 404, { id }); } }
export class InvalidPageError extends DomainError { constructor(detail: string) { super('CMS_PAGE_INVALID', detail, 422, { detail }); } }
export class InvalidBannerError extends DomainError { constructor(detail: string) { super('CMS_BANNER_INVALID', detail, 422, { detail }); } }
export class CmsForbiddenError extends DomainError { constructor(detail = 'forbidden') { super('CMS_FORBIDDEN', detail, 403, {}); } }
