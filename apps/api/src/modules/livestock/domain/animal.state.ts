// modules/livestock/domain/animal.state.ts · STATE MACHINE for animals.status (Law 5).
//   active → sold | deceased | lost   (the three terminal "retired" states; no resurrection)
import { DomainError } from '../../../shared/errors/app-error';

export const ANIMAL_STATUSES = ['active', 'sold', 'deceased', 'lost'] as const;
export type AnimalStatus = (typeof ANIMAL_STATUSES)[number];

const TRANSITIONS: Readonly<Record<AnimalStatus, readonly AnimalStatus[]>> = Object.freeze({
  active:   ['sold', 'deceased', 'lost'],
  sold:     [],
  deceased: [],
  lost:     [],
});
export class IllegalAnimalTransitionError extends DomainError {
  constructor(from: string, to: string) { super('ANIMAL_ILLEGAL_TRANSITION', `Cannot move animal ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: AnimalStatus, to: AnimalStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: AnimalStatus, to: AnimalStatus): void { if (!canTransition(from, to)) throw new IllegalAnimalTransitionError(from, to); }
export function isActive(s: AnimalStatus): boolean { return s === 'active'; }
