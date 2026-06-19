// modules/land-soil-weather/domain/land-soil-weather.errors.ts · typed errors with stable codes.
import { AppError, DomainError, NotFoundError } from '../../../shared/errors/app-error';

export class ParcelNotFoundError extends NotFoundError { constructor(id: string) { super('Land parcel not found'); (this as any).code = 'PARCEL_NOT_FOUND'; (this as any).details = { id }; } }
export class CropSeasonNotFoundError extends NotFoundError { constructor(id: string) { super('Crop season not found'); (this as any).code = 'CROP_SEASON_NOT_FOUND'; (this as any).details = { id }; } }
export class SoilTestNotFoundError extends NotFoundError { constructor(id: string) { super('Soil test not found'); (this as any).code = 'SOIL_TEST_NOT_FOUND'; (this as any).details = { id }; } }

export class InvalidParcelError extends DomainError { constructor(message: string) { super('PARCEL_INVALID', message, 422); } }
export class InvalidCropSeasonError extends DomainError { constructor(message: string) { super('CROP_SEASON_INVALID', message, 422); } }
export class InvalidSoilTestError extends DomainError { constructor(message: string) { super('SOIL_TEST_INVALID', message, 422); } }
export class LandForbiddenError extends AppError { constructor(message = 'Not allowed on this land resource') { super('LAND_FORBIDDEN', message, 403); } }
