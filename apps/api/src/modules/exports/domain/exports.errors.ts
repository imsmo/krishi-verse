// modules/exports/domain/exports.errors.ts · typed errors with stable codes (mapped to HTTP/i18n).
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class ExporterNotFoundError extends NotFoundError { constructor(id: string) { super('Exporter registration not found'); (this as any).code = 'EXPORTER_NOT_FOUND'; (this as any).details = { id }; } }
export class ShipmentNotFoundError extends NotFoundError { constructor(id: string) { super('Export shipment not found'); (this as any).code = 'EXPORT_SHIPMENT_NOT_FOUND'; (this as any).details = { id }; } }
export class DocumentNotFoundError extends NotFoundError { constructor(id: string) { super('Export document not found'); (this as any).code = 'EXPORT_DOCUMENT_NOT_FOUND'; (this as any).details = { id }; } }

export class InvalidExporterError extends DomainError { constructor(message: string) { super('EXPORTER_INVALID', message, 422); } }
export class InvalidShipmentError extends DomainError { constructor(message: string) { super('EXPORT_SHIPMENT_INVALID', message, 422); } }
export class InvalidDocumentError extends DomainError { constructor(message: string) { super('EXPORT_DOCUMENT_INVALID', message, 422); } }
export class InvalidDocTypeError extends DomainError { constructor(code: string) { super('EXPORT_DOC_TYPE_INVALID', `Unknown export document type '${code}'`, 422, { code }); } }
/** Cannot ship until every document is verified (none pending/rejected) and at least one exists. */
export class DocsNotClearedError extends DomainError { constructor() { super('EXPORT_DOCS_NOT_CLEARED', 'All export documents must be verified before shipping', 409); } }
export class RegNoExistsError extends AppError { constructor() { super('EXPORTER_REG_EXISTS', 'An exporter registration with this authority + number already exists', 409); } }
export class ExportsForbiddenError extends AppError { constructor(message = 'Not allowed on this export resource') { super('EXPORTS_FORBIDDEN', message, 403); } }
