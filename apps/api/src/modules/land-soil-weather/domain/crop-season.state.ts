// modules/land-soil-weather/domain/crop-season.state.ts · STATE MACHINE for crop_seasons.status (Law 5).
//   planned → sown → harvested   (+ abandoned from planned|sown)
import { DomainError } from '../../../shared/errors/app-error';

export const CROP_STATUSES = ['planned', 'sown', 'harvested', 'abandoned'] as const;
export type CropStatus = (typeof CROP_STATUSES)[number];

const TRANSITIONS: Readonly<Record<CropStatus, readonly CropStatus[]>> = Object.freeze({
  planned:   ['sown', 'abandoned'],
  sown:      ['harvested', 'abandoned'],
  harvested: [],
  abandoned: [],
});
export class IllegalCropTransitionError extends DomainError {
  constructor(from: string, to: string) { super('CROP_SEASON_ILLEGAL_TRANSITION', `Cannot move crop season ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: CropStatus, to: CropStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: CropStatus, to: CropStatus): void { if (!canTransition(from, to)) throw new IllegalCropTransitionError(from, to); }
export function isTerminal(s: CropStatus): boolean { return s === 'harvested' || s === 'abandoned'; }
