// modules/communication/policies/communication.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded 0004).
//   notification.manage — author tenant notification templates + read the tenant delivery log (tenant_admin/ops).
// A user's OWN inbox + preferences + quiet hours need only authentication (ownership is the caller's userId,
// never a client-supplied id) — no special permission.
//   message.moderate — review + unflag/lock chat (support_agent/ai_ops/tenant_admin).
// Chat itself (open/post/read) + masked calls need only authentication; access is gated by PARTICIPANT
// membership (server-side), never a client-supplied id — a non-participant read 404s (anti-IDOR).
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const CommPermissions = { Manage: 'notification.manage', Moderate: 'message.moderate' } as const;
export const canManageComms = (ctx: RequestContext) => ctx.permissions.has('notification.manage') || ctx.permissions.has('*');
export const canModerateMessages = (ctx: RequestContext) => ctx.permissions.has('message.moderate') || ctx.permissions.has('*');
