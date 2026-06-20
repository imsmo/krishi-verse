// modules/cms/domain/cms-page.state.ts · STATE MACHINE for cms_pages.status (Law 5).
//   draft → published → archived ; draft → archived. A published page is edited by creating a NEW version row
//   (a fresh draft), never by mutating the live one — so the live content is immutable once published.
import { DomainError } from '../../../shared/errors/app-error';
import { PageStatus } from './cms.events';

const TRANSITIONS: Readonly<Record<PageStatus, readonly PageStatus[]>> = Object.freeze({
  draft:     ['published', 'archived'],
  published: ['archived'],
  archived:  [],
});
export class IllegalPageTransitionError extends DomainError {
  constructor(from: string, to: string) { super('CMS_PAGE_ILLEGAL_TRANSITION', `Cannot move page ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: PageStatus, to: PageStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: PageStatus, to: PageStatus): void { if (!canTransition(from, to)) throw new IllegalPageTransitionError(from, to); }
