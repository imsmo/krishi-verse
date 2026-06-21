// apps/admin-api/src/modules/announcements/domain/announcements.errors.ts · typed errors → HTTP via HttpException
// subclasses with stable codes (mirrors the other ops modules).
import { HttpException, HttpStatus } from '@nestjs/common';

class DomainHttpError extends HttpException {
  constructor(code: string, message: string, status: HttpStatus, detail: Record<string, unknown> = {}) {
    super({ code, message, ...detail }, status);
  }
}
export class AnnouncementNotFoundError extends DomainHttpError {
  constructor(ref: string) { super('ANNOUNCEMENT_NOT_FOUND', `announcement ${ref} not found`, HttpStatus.NOT_FOUND, { ref }); }
}
export class InvalidAnnouncementError extends DomainHttpError {
  constructor(detail: string) { super('ANNOUNCEMENT_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
export class InvalidScheduleError extends DomainHttpError {
  constructor(detail: string) { super('ANNOUNCEMENT_SCHEDULE_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); }
}
/** Content/schedule of a published/expired/archived announcement is immutable — archive + recreate instead. */
export class AnnouncementImmutableError extends DomainHttpError {
  constructor(status: string) { super('ANNOUNCEMENT_IMMUTABLE', `an announcement in status '${status}' cannot be edited`, HttpStatus.CONFLICT, { status }); }
}
export class IllegalAnnouncementTransitionError extends Error {
  readonly code = 'ANNOUNCEMENT_ILLEGAL_TRANSITION';
  constructor(public readonly from: string, public readonly to: string) {
    super(`Cannot move announcement ${from}→${to}`);
    this.name = 'IllegalAnnouncementTransitionError';
  }
}
