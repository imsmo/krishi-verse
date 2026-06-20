// modules/education/domain/course.state.ts · STATE MACHINE for courses.status (Law 5).
//   draft → review → published ; published ↔ paused ; any non-archived → archived (terminal).
//   (an author submits for review; an editor/admin publishes; pausing hides it without losing enrollments)
import { DomainError } from '../../../shared/errors/app-error';
import { CourseStatus } from './education.events';

const TRANSITIONS: Readonly<Record<CourseStatus, readonly CourseStatus[]>> = Object.freeze({
  draft:     ['review', 'archived'],
  review:    ['published', 'draft', 'archived'],
  published: ['paused', 'archived'],
  paused:    ['published', 'archived'],
  archived:  [],
});
export class IllegalCourseTransitionError extends DomainError {
  constructor(from: string, to: string) { super('COURSE_ILLEGAL_TRANSITION', `Cannot move course ${from}→${to}`, 409, { from, to }); }
}
export function canTransition(from: CourseStatus, to: CourseStatus): boolean { return TRANSITIONS[from]?.includes(to) ?? false; }
export function assertTransition(from: CourseStatus, to: CourseStatus): void { if (!canTransition(from, to)) throw new IllegalCourseTransitionError(from, to); }
export function isEnrollable(s: CourseStatus): boolean { return s === 'published'; }
