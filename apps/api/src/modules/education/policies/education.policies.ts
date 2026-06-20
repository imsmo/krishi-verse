// modules/education/policies/education.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded 0004).
//   course.author  — become an instructor + author/edit own courses + lessons + submit for review.
//   course.publish — review/publish/pause/archive courses (editor/admin); the publishing gate.
// Enrolling + tracking progress need only authentication (ownership = the caller's userId; no IDOR).
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const EducationPermissions = { Author: 'course.author', Publish: 'course.publish' } as const;
export const canAuthor = (ctx: RequestContext) => ctx.permissions.has('course.author') || ctx.permissions.has('*');
export const canPublish = (ctx: RequestContext) => ctx.permissions.has('course.publish') || ctx.permissions.has('*');
export const isEducationAdmin = (ctx: RequestContext) => ctx.permissions.has('course.publish') || ctx.permissions.has('*');
