// modules/education/policies/education.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded 0004).
//   course.author    — become an instructor + author/edit own courses + lessons + submit for review.
//   course.publish   — review/publish/pause/archive courses (editor/admin); the publishing gate.
//   channel.host     — register an external content channel + publish resources + host live sessions
//                      (the channel itself still needs content.moderate approval before it can publish/stream).
//   content.moderate — approve/suspend/reject channels + take down resources (tenant admin / support).
// Enrolling + tracking progress + browsing approved content need only authentication (no IDOR).
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const EducationPermissions = { Author: 'course.author', Publish: 'course.publish', Host: 'channel.host', Moderate: 'content.moderate' } as const;
export const canAuthor = (ctx: RequestContext) => ctx.permissions.has('course.author') || ctx.permissions.has('*');
export const canPublish = (ctx: RequestContext) => ctx.permissions.has('course.publish') || ctx.permissions.has('*');
export const isEducationAdmin = (ctx: RequestContext) => ctx.permissions.has('course.publish') || ctx.permissions.has('*');
export const canHost = (ctx: RequestContext) => ctx.permissions.has('channel.host') || ctx.permissions.has('*');
export const canModerateContent = (ctx: RequestContext) => ctx.permissions.has('content.moderate') || ctx.permissions.has('*');
