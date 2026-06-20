// apps/admin-api/src/modules/ai-models-ops/domain/ai-models.errors.ts · typed errors → HTTP status via the
// HttpException subclasses (admin-api uses Nest's exception filter). Stable codes in the body.
import { HttpException, HttpStatus } from '@nestjs/common';

class DomainHttpError extends HttpException {
  constructor(code: string, message: string, status: HttpStatus, detail: Record<string, unknown> = {}) {
    super({ code, message, ...detail }, status);
  }
}
export class AiModelNotFoundError extends DomainHttpError { constructor(ref: string) { super('AI_MODEL_NOT_FOUND', `AI model ${ref} not found`, HttpStatus.NOT_FOUND, { ref }); } }
export class InvalidAiModelError extends DomainHttpError { constructor(detail: string) { super('AI_MODEL_INVALID', detail, HttpStatus.UNPROCESSABLE_ENTITY, { detail }); } }
export class DuplicateAiModelError extends DomainHttpError { constructor(code: string, version: string) { super('AI_MODEL_DUPLICATE', `model ${code}@${version} already registered`, HttpStatus.CONFLICT, { code, version }); } }
