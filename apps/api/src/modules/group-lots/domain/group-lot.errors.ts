// modules/group-lots/domain/group-lot.errors.ts · typed errors with stable codes.
import { DomainError } from '../../../shared/errors/app-error';

export class GroupLotForbiddenError extends DomainError {
  constructor(msg = 'requires group_lot.coordinate') { super('GROUP_LOT_FORBIDDEN', msg, 403); }
}
export class GroupLotNotFoundError extends DomainError {
  constructor(id: string) { super('GROUP_LOT_NOT_FOUND', `Group lot ${id} not found`, 404, { id }); }
}
export class PledgeClosedError extends DomainError {
  constructor() { super('GROUP_LOT_PLEDGE_CLOSED', 'Pledging is closed for this lot', 409); }
}
export class InvalidGroupLotError extends DomainError {
  constructor(msg: string) { super('GROUP_LOT_INVALID', msg, 422); }
}
export class EmptyGroupLotError extends DomainError {
  constructor() { super('GROUP_LOT_EMPTY', 'Cannot settle a lot with no pledges', 422); }
}
