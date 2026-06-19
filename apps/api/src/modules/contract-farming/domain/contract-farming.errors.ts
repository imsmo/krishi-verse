// modules/contract-farming/domain/contract-farming.errors.ts · typed errors with stable codes.
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class TemplateNotFoundError extends NotFoundError { constructor(id: string) { super('Contract template not found'); (this as any).code = 'TEMPLATE_NOT_FOUND'; (this as any).details = { id }; } }
export class ContractNotFoundError extends NotFoundError { constructor(id: string) { super('Farming contract not found'); (this as any).code = 'CONTRACT_NOT_FOUND'; (this as any).details = { id }; } }
export class GrowerNotFoundError extends NotFoundError { constructor(id: string) { super('Contract grower not found'); (this as any).code = 'GROWER_NOT_FOUND'; (this as any).details = { id }; } }
export class MilestoneNotFoundError extends NotFoundError { constructor(id: string) { super('Contract milestone not found'); (this as any).code = 'MILESTONE_NOT_FOUND'; (this as any).details = { id }; } }
export class AdvanceNotFoundError extends NotFoundError { constructor(id: string) { super('Input advance not found'); (this as any).code = 'ADVANCE_NOT_FOUND'; (this as any).details = { id }; } }

export class InvalidContractError extends DomainError { constructor(message: string) { super('CONTRACT_INVALID', message, 422); } }
export class InvalidGrowerError extends DomainError { constructor(message: string) { super('GROWER_INVALID', message, 422); } }
export class InvalidAdvanceError extends DomainError { constructor(message: string) { super('ADVANCE_INVALID', message, 422); } }
/** Contract must be 'active' before advances/milestones/settlement. */
export class ContractNotActiveError extends DomainError { constructor(status: string) { super('CONTRACT_NOT_ACTIVE', `Contract is not active (status: ${status})`, 409, { status }); } }
/** Settlement requires a FIXED price model in this build (floor/ceiling/formula deferred). */
export class UnsupportedPriceModelError extends DomainError { constructor(model: string) { super('PRICE_MODEL_UNSUPPORTED', `Settlement supports only the fixed price model (got '${model}')`, 422, { model }); } }
export class GrowerAlreadyEnrolledError extends AppError { constructor() { super('GROWER_ALREADY_ENROLLED', 'This grower is already enrolled on this contract for that parcel', 409); } }
export class ContractConcurrencyError extends AppError { constructor(id: string) { super('CONTRACT_CONCURRENCY', 'Contract was modified concurrently; retry', 409, { id }); } }
export class ContractFarmingForbiddenError extends AppError { constructor(message = 'Not allowed on this contract resource') { super('CONTRACT_FARMING_FORBIDDEN', message, 403); } }
