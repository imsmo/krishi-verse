// modules/labour/domain/labour.errors.ts · typed errors with stable codes (mapped to i18n + HTTP by the filter).
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class WorkerProfileNotFoundError extends NotFoundError { constructor(id: string) { super('Worker profile not found'); (this as any).code = 'WORKER_NOT_FOUND'; (this as any).details = { id }; } }
export class BookingNotFoundError extends NotFoundError { constructor(id: string) { super('Labour booking not found'); (this as any).code = 'BOOKING_NOT_FOUND'; (this as any).details = { id }; } }
export class AssignmentNotFoundError extends NotFoundError { constructor(id: string) { super('Booking assignment not found'); (this as any).code = 'ASSIGNMENT_NOT_FOUND'; (this as any).details = { id }; } }

/** A worker may register only ONE profile (worker_profiles.user_id is UNIQUE). */
export class WorkerAlreadyRegisteredError extends AppError { constructor() { super('WORKER_ALREADY_REGISTERED', 'You already have a worker profile', 409); } }

/** HARD RULE (worker_profiles.age_verified_18): an unverified worker cannot be assigned to a booking. */
export class WorkerNotAgeVerifiedError extends DomainError { constructor(workerId: string) { super('WORKER_NOT_AGE_VERIFIED', 'Worker is not age-verified (18+) and cannot be assigned', 409, { workerId }); } }

/** THE DIGNITY FLOOR (chk_dignity_floor in physics): an offer below the statutory minimum is rejected. */
export class WageBelowMinimumError extends DomainError {
  constructor(offeredMinor: bigint, floorMinor: bigint) {
    super('WAGE_BELOW_MINIMUM', 'Offered wage is below the statutory minimum wage', 422,
      { offeredMinor: offeredMinor.toString(), floorMinor: floorMinor.toString() });
  }
}

/** No statutory minimum-wage row resolves for the booking's region + skill level → fail closed. */
export class NoMinimumWageFloorError extends DomainError {
  constructor(regionId: string, skillLevel: string) {
    super('NO_MIN_WAGE_FLOOR', 'No statutory minimum wage is configured for this region/skill level', 422, { regionId, skillLevel });
  }
}

/** More workers accepted/assigned than the booking needs. */
export class BookingFullError extends DomainError { constructor(needed: number) { super('BOOKING_FULL', 'Booking already has all the workers it needs', 409, { needed }); } }

/** Optimistic-lock loss on the booking (concurrent writer). */
export class BookingConcurrencyError extends AppError { constructor(id: string) { super('BOOKING_CONCURRENCY', 'Booking was modified concurrently; retry', 409, { id }); } }

/** Caller is not the employer / worker / admin entitled to act here. */
export class LabourForbiddenError extends AppError { constructor(message = 'Not allowed on this labour resource') { super('LABOUR_FORBIDDEN', message, 403); } }

/** A worker may hold only one assignment per booking (booking_assignments UNIQUE(booking_id, worker_id)). */
export class WorkerAlreadyAssignedError extends AppError { constructor() { super('WORKER_ALREADY_ASSIGNED', 'Worker is already assigned to this booking', 409); } }

/** Acting on a booking whose state forbids it (e.g. paying a non-completed booking). */
export class BookingNotPayableError extends DomainError { constructor(status: string) { super('BOOKING_NOT_PAYABLE', `Booking cannot be paid from status '${status}'`, 409, { status }); } }

/** Unknown labour_demand_type code. */
export class InvalidDemandTypeError extends DomainError { constructor(code: string) { super('INVALID_DEMAND_TYPE', `Unknown labour demand type '${code}'`, 422, { code }); } }
/** The referenced skill does not exist / is inactive. */
export class SkillNotFoundError extends NotFoundError { constructor(id: string) { super('Skill not found'); (this as any).code = 'SKILL_NOT_FOUND'; (this as any).details = { id }; } }

/** A worker may only clock in once they are an ACCEPTED assignee on the booking. */
export class AssignmentNotAcceptedError extends DomainError { constructor(status: string) { super('ASSIGNMENT_NOT_ACCEPTED', `Cannot clock in from assignment status '${status}'`, 409, { status }); } }
/** The clock-in location is outside the booking's ≤100m geofence (server-computed; the device can't fake it). */
export class OutOfFenceError extends DomainError { constructor(distanceM: number, fenceM: number) { super('ATTENDANCE_OUT_OF_FENCE', `Clock-in is ${distanceM}m from the farm (fence is ${fenceM}m)`, 422, { distanceM, fenceM }); } }
/** A worker has already clocked in for this assignment today (one attendance per assignment per day). */
export class AlreadyClockedInError extends DomainError { constructor() { super('ATTENDANCE_ALREADY_CLOCKED_IN', 'Already clocked in for today', 409); } }
