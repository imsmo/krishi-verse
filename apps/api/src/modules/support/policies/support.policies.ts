// modules/support/policies/support.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded 0004).
//   support.handle — an agent: assign, respond, transition, escalate, resolve/close, view the queue + any ticket
//   in-tenant. Opening a ticket + viewing/CSAT-rating one's OWN ticket needs only authentication (ownership =
//   the caller's userId; a non-owner non-agent read returns 404 — no IDOR).
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const SupportPermissions = { Handle: 'support.handle' } as const;
export const canHandleSupport = (ctx: RequestContext) => ctx.permissions.has('support.handle') || ctx.permissions.has('*');
