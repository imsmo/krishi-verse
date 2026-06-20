// modules/ai-governance/domain/ai-governance.errors.ts · typed errors, stable codes → HTTP.
import { DomainError } from '../../../shared/errors/app-error';

export class AiModelNotFoundError extends DomainError { constructor(ref: string) { super('AI_MODEL_NOT_FOUND', `AI model ${ref} not found`, 404, { ref }); } }
export class InvalidAiModelError extends DomainError { constructor(detail: string) { super('AI_MODEL_INVALID', detail, 422, { detail }); } }
export class InvalidInferenceError extends DomainError { constructor(detail: string) { super('AI_INFERENCE_INVALID', detail, 422, { detail }); } }
export class InferenceNotFoundError extends DomainError { constructor(id: string) { super('AI_INFERENCE_NOT_FOUND', `Inference ${id} not found`, 404, { id }); } }
export class ReviewNotFoundError extends DomainError { constructor(id: string) { super('AI_REVIEW_NOT_FOUND', `Review item ${id} not found`, 404, { id }); } }
export class ReviewAlreadyClaimedError extends DomainError { constructor(id: string) { super('AI_REVIEW_ALREADY_CLAIMED', `Review item ${id} is already being handled`, 409, { id }); } }
export class ModerationReportNotFoundError extends DomainError { constructor(id: string) { super('MODERATION_REPORT_NOT_FOUND', `Moderation report ${id} not found`, 404, { id }); } }
export class InvalidModerationError extends DomainError { constructor(detail: string) { super('MODERATION_INVALID', detail, 422, { detail }); } }
export class AiForbiddenError extends DomainError { constructor(detail = 'forbidden') { super('AI_FORBIDDEN', detail, 403, {}); } }
