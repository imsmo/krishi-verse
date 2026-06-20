// modules/education/domain/creator.errors.ts · typed errors, stable codes → HTTP (creator-content layer).
import { DomainError } from '../../../shared/errors/app-error';

export class ChannelNotFoundError extends DomainError { constructor(id: string) { super('CHANNEL_NOT_FOUND', `Channel ${id} not found`, 404, { id }); } }
export class ResourceNotFoundError extends DomainError { constructor(id: string) { super('RESOURCE_NOT_FOUND', `Resource ${id} not found`, 404, { id }); } }
export class LiveSessionNotFoundError extends DomainError { constructor(id: string) { super('LIVE_SESSION_NOT_FOUND', `Live session ${id} not found`, 404, { id }); } }
export class ChannelNotApprovedError extends DomainError { constructor(status: string) { super('CHANNEL_NOT_APPROVED', `Channel is ${status}; an approved channel is required to host`, 409, { status }); } }
export class InvalidChannelError extends DomainError { constructor(detail: string) { super('CHANNEL_INVALID', detail, 422, { detail }); } }
export class InvalidResourceError extends DomainError { constructor(detail: string) { super('RESOURCE_INVALID', detail, 422, { detail }); } }
export class InvalidLiveSessionError extends DomainError { constructor(detail: string) { super('LIVE_SESSION_INVALID', detail, 422, { detail }); } }
export class CreatorForbiddenError extends DomainError { constructor(detail = 'forbidden') { super('CREATOR_FORBIDDEN', detail, 403, {}); } }
