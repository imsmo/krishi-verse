# support-oversight (admin-api · god-mode plane, Law 11)

The platform **cross-tenant support oversight** plane — the NOC view over `support_tickets` (0012). It lets
platform support leads watch the whole fleet's helpdesk health (ticket queue, **SLA-breach** queue, per-tenant
health) and, when a tenant's support is failing its SLA, **escalate** a ticket (raise severity / move to
`escalated` / reassign to a platform lead). Read-heavy with one consequential, audited write. Money-free.

## Endpoints (URI-versioned, all admin-authed)
| Method | Path | Owner perm | Elevation |
|---|---|---|---|
| GET | `/v1/support/tickets` · `/tickets/:id` | `support.oversight.read` | — (cross-tenant queue + detail w/ SLA state) |
| GET | `/v1/support/sla-breaches` | `support.oversight.read` | — (breach queue, most-urgent first) |
| GET | `/v1/support/tenant-health` | `support.oversight.read` | — (per-tenant rollup / top breached tenants) |
| POST | `/v1/support/tickets/:id/escalate` | `support.oversight.manage` | **FIDO2 + step-up** (raise severity / escalate / reassign) |

## What it owns
- **Cross-tenant reads** over `support_tickets`: the ticket queue (filter by tenant / status / severity / assigned
  / SLA-breached), the **SLA-breach queue** (ordered P0-first then oldest), a single ticket with its computed SLA
  state, and **per-tenant health** (open / breached / P0-open counts + oldest-open age; with a `tenantId` ⇒ that
  tenant, without ⇒ the top tenants by open breaches). admin-api connects as `kv_admin`, which **bypasses RLS** —
  that's how the god-mode plane sees every tenant; every read is keyset + bounded (max LIMIT 100).
- **SLA math** (`domain/sla.ts`): mirrors apps/api's `SLA_MINUTES` (P0 15m/4h … P3 8h/72h) so the breach view
  matches what the tenant plane computed at open. A ticket is breached only while WORKING and past an unsatisfied
  first-response / resolution due date.
- **Escalation** (the one write): raise severity (**raise-only** — never a downgrade), move the ticket to
  `escalated` through the ticket **state machine** (Law 5; a resolved/closed ticket can't be escalated),
  recompute the SLA clock from the new severity, and optionally reassign to a (validated) platform user. Must
  change something. One ACID tx + an `audit_log` row.

## Threats considered (§4 + Law 11)
- **No privilege escalation (Law 11).** `support.oversight.read`/`support.oversight.manage` are PLATFORM owner
  perms (roles `platform_support_oversight`/`platform_support_oversight_viewer`); never `*`, never tenant-
  assignable, never money/god (unit-tested). Reads need `read`; the cross-tenant write needs `manage` + FIDO2 +
  step-up.
- **Bounded cross-tenant exposure.** This plane is intentionally cross-tenant (NOC), but every list is keyset +
  capped at 100; no per-row N+1; the breach/health predicates run in SQL. A missing ticket → 404; a reassign to a
  non-existent user → 404 (validated before the row lock — no IDOR).
- **Safe escalation.** Severity can only be RAISED; the status change goes through the same state machine the
  tenant plane uses; you cannot escalate a resolved/closed ticket; a no-op escalation is rejected. Recomputing the
  SLA from the new severity is deliberate (a P0 escalation gets a tight clock).
- **Audit.** The escalate write commits an append-only `audit_log` row IN THE SAME TX (actor, tenant, old→new
  severity/status/assignee, mandatory reason, ip, request_id). Reads are access-logged by the @Global interceptor.
- **No PII / money.** Support is a helpdesk — no money path. Responses carry ticket metadata (no message bodies /
  PII); the reads project only `support_tickets` columns.

## Tests
- Unit (`support-oversight.spec.ts`): SLA math (breach detection, severity-raise guard, recompute); ticket state
  machine; escalate entity (raise-only / state-machine / recompute / must-change / no-escalate-closed); owner-RBAC
  + no-escalation + no-`*`; DTO validation; services proving 404s (ticket / assignee, pre-lock), audit-in-tx on
  escalate, and computed SLA on reads.
- Integration (`support-oversight.integration.spec.ts`, real Postgres, gated on `DATABASE_ADMIN_URL`): seed a
  breached ticket; assert `kv_admin` sees it CROSS-TENANT (RLS bypassed) in the breach queue, the per-tenant health
  rollup counts it, and an escalate raises severity → `escalated` and writes an `audit_log` row.
