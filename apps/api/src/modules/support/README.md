# support (PRD §50) — helpdesk / support tickets

A multi-channel support desk: requesters file tickets, agents work them under SLA, and an escalated dispute
auto-opens a ticket. Money-free. Gated by the `support` feature flag (default **OFF**).

## What it owns

- **Tickets** (`support_tickets`) — one aggregate, lifecycle via the `ticket_status` machine (Law 5):
  `open ↔ pending_customer ↔ pending_internal ↔ escalated → resolved → closed`, with `resolved/closed →
  reopened → open`. Opened over a `channel` (app/whatsapp/ivr/phone/email/ambassador) at a `severity`
  (P0–P3) that derives the **SLA due dates** (first-response + resolution) at creation. The first agent reply
  stamps `first_responded_at`. CSAT (1–5) is captured only on a resolved/closed ticket, by the requester.

## Flows

- **Requester** (any authenticated user): `open` (Idempotency-Key), view + `csat` their own tickets.
- **Agent** (`support.handle`): `assign`, `respond`, `transition` (resolve/close/escalate/pending_*), and read
  the `queue` / `assigned` boxes + any ticket in-tenant. Every agent action writes an `audit_log` row in the tx.
- **Auto-open** — `DisputeEscalatedHandler` consumes `disputes.dispute_escalated` and opens a P1 ticket so an
  agent picks it up; idempotent via a deterministic `ticket_no` derived from the dispute id (`autoOpen` no-ops
  if it already exists).
- **SLA breach** — the `sla-breach-escalation` worker job (BYPASSRLS pool) escalates working tickets past their
  resolution SLA via `escalateOverdue` (idempotent, in-tenant tx), bounded per run.

## Surface (v1, under the `support` flag)

`POST /v1/support/tickets` (Idempotency-Key), `GET /v1/support/tickets` (box=`mine|assigned|queue`),
`GET /v1/support/tickets/:id`, `POST /:id/csat` (requester); `POST /:id/{assign,respond,transition}`
(`support.handle`).

## Threats considered (§4)

- **Tenant isolation / RLS** — `tenant_id` binds every query; `support_tickets` is RLS-protected.
- **No IDOR** — reads + CSAT are requester-owned (an agent may also read); a stranger gets **404** (not 403),
  no cross-tenant or cross-user enumeration. The `queue`/`assigned` boxes require `support.handle`.
- **No privilege escalation** — agent actions throw without `support.handle`; CSAT is requester-only.
- **Abuse/DoS** — open is idempotent per (user, endpoint); lists bounded + keyset; auto-open writes at most one
  ticket per dispute (deterministic `ticket_no`, no write amplification); audit on agent/state changes.
- **No PII in logs** — structured events carry ids only.

## Deferred (schema present, not built)

Threaded replies (the ticket links a `conversation_id` to the communication module's conversations — the link
is stored, message exchange lives there); CSAT-survey dispatch (via the notification spine); auto-routing /
round-robin assignment; knowledge-base deflection; first-response-SLA breach alerts (only resolution-SLA
escalation is wired).

## Tests

`__tests__/support-domain.spec.ts` (SLA derivation, status machine, first-response-once, CSAT rules),
`support-ticket.service.spec.ts` (open, agent-gated actions + audit, 404 IDOR, idempotent autoOpen),
`tenant-isolation.spec.ts` (CI gate), `support.integration.spec.ts` (real Postgres: open → assign → resolve →
CSAT → stranger 404 → cross-tenant RLS denial; runs when `DATABASE_URL` is set).
