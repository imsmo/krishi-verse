// apps/admin-api/src/modules/platform-reports/domain/platform-reports.errors.ts · typed errors → HTTP via
// HttpException subclasses with stable codes (mirrors the other ops modules).
import { HttpException, HttpStatus } from '@nestjs/common';

class DomainHttpError extends HttpException {
  constructor(code: string, message: string, status: HttpStatus, detail: Record<string, unknown> = {}) {
    super({ code, message, ...detail }, status);
  }
}
/** A report window must be a valid, forward, bounded range (caps the scan — abuse/DoS guard §4/§5). */
export class InvalidWindowError extends DomainHttpError {
  constructor(detail: string) { super('REPORT_WINDOW_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
