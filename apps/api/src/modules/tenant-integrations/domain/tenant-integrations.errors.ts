// modules/tenant-integrations/domain/tenant-integrations.errors.ts · typed errors with stable codes.
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class ProviderNotFoundError extends NotFoundError {
  constructor(code: string) { super('Integration provider not found'); (this as any).code = 'INTEGRATION_PROVIDER_NOT_FOUND'; (this as any).details = { code }; }
}
export class IntegrationNotFoundError extends NotFoundError {
  constructor(providerCode: string) { super('Integration not found'); (this as any).code = 'TENANT_INTEGRATION_NOT_FOUND'; (this as any).details = { providerCode }; }
}
export class IntegrationsForbiddenError extends AppError {
  constructor(message = 'Not allowed to manage integrations') { super('INTEGRATIONS_FORBIDDEN', message, 403); }
}
export class InvalidIntegrationError extends DomainError {
  constructor(message: string) { super('TENANT_INTEGRATION_INVALID', message, 422); }
}
