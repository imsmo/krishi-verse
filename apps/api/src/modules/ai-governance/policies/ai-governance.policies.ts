// modules/ai-governance/policies/ai-governance.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded
// in db/seeds/core/0004). Least-privilege:
//   ai.review       — AI Ops: read the model registry + inference audit log, record inferences, and work the
//                     human-in-the-loop review queue (claim/resolve). Granted to ai_ops (+ '*').
//   content.moderate — handle moderation reports (action/dismiss). Granted to tenant_admin/support_agent/ai_ops.
// Filing a moderation report needs NO special permission (any authenticated user can report content);
// authoring/promoting models is a PLATFORM/admin-api concern (Law 11) and is NOT exposed on the tenant API.
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const AiPermissions = { Review: 'ai.review', Moderate: 'content.moderate' } as const;
export const canReviewAi = (ctx: RequestContext) => ctx.permissions.has('ai.review') || ctx.permissions.has('*');
export const canModerateContent = (ctx: RequestContext) => ctx.permissions.has('content.moderate') || ctx.permissions.has('*');
