// core/bulk/domain/bulk-import.errors.ts · typed errors, stable codes → HTTP.
import { DomainError } from '../../../shared/errors/app-error';

export class BulkJobNotFoundError extends DomainError { constructor(id: string) { super('BULK_JOB_NOT_FOUND', `Bulk import job ${id} not found`, 404, { id }); } }
export class UnknownImportTypeError extends DomainError { constructor(t: string) { super('BULK_IMPORT_TYPE_UNKNOWN', `No applier registered for import type "${t}"`, 422, { importType: t }); } }
export class InvalidBulkJobError extends DomainError { constructor(detail: string) { super('BULK_JOB_INVALID', detail, 422, { detail }); } }
export class BulkJobForbiddenError extends DomainError { constructor(detail = 'forbidden') { super('BULK_FORBIDDEN', detail, 403, {}); } }
export class TooManyActiveJobsError extends DomainError { constructor(max: number) { super('BULK_TOO_MANY_ACTIVE', `Too many active import jobs (max ${max}); wait for one to finish`, 429, { max }); } }
export class BulkJobNotProcessableError extends DomainError { constructor(status: string) { super('BULK_JOB_NOT_PROCESSABLE', `Job in status ${status} cannot be processed`, 409, { status }); } }
// CSV parse / shape problems (the whole file is unusable — distinct from per-row failures).
export class CsvParseError extends DomainError { constructor(detail: string) { super('BULK_CSV_INVALID', detail, 422, { detail }); } }
export class MissingColumnsError extends DomainError { constructor(missing: string[]) { super('BULK_CSV_MISSING_COLUMNS', `CSV is missing required columns: ${missing.join(', ')}`, 422, { missing }); } }
