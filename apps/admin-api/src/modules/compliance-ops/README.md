# compliance-ops (admin-api · god-mode plane, Law 11)

The platform **DPDP / compliance** ops module. It gives platform compliance staff (DPO/auditors) the controls to
honour data-protection obligations: the **data-subject-request queue** (DPDP rights), the **data-export approval
gate** (mass-PII egress control), a read-only **audit-log explorer**, **retention-policy** admin, and the DPDP §8
**breach-response console**. It owns the DECISIONS; the actual data deletion/export/retention is executed by the
worker.

## Endpoints (URI-versioned, all admin-authed)
| Method | Path | Owner perm | Elevation |
|---|---|---|---|
| GET | `/v1/compliance/dsr` · `/dsr/:id` | `compliance.read` | — (keyset queue + detail) |
| PATCH | `/v1/compliance/dsr/:id` | `compliance.manage` | **FIDO2 + step-up** (start/complete/reject) |
| GET | `/v1/compliance/exports` | `compliance.read` | — (keyset list) |
| POST | `/v1/compliance/exports/:id/decision` | `compliance.manage` | **FIDO2 + step-up** (approve/reject) |
| GET | `/v1/compliance/audit` | `compliance.read` | — (audit-log explorer, partition-pruned keyset) |
| GET | `/v1/compliance/retention` | `compliance.read` | — |
| POST | `/v1/compliance/retention` | `compliance.manage` | **FIDO2 + step-up** (upsert policy) |
| GET | `/v1/compliance/breaches` · `/breaches/:id` | `compliance.read` | — |
| POST | `/v1/compliance/breaches` | `compliance.manage` | **FIDO2 + step-up** (open) |
| PATCH | `/v1/compliance/breaches/:id` | `compliance.manage` | **FIDO2 + step-up** (contain/notify/close) |

## What it owns
- **DSR queue** over `data_subject_requests` (0003): state machine `open→in_progress→completed\|rejected` (Law 5);
  an **erasure cannot complete while its 90-day cooling window is open** (DPDP). Each transition is one ACID tx +
  audit row; the worker performs the actual access-bundle/erasure.
- **Export approval** over `data_export_jobs` (0015 + 0034 approval columns): a tenant full-export / DPDP
  portability bundle stays `approval_status='pending'` until platform compliance approves it; the export worker
  claims only `approved` jobs. `pending→approved\|rejected`, no re-decide.
- **Audit-log explorer** over the append-only partitioned `audit_log`: keyset over **(created_at, id)** — the
  partition key first, so PG prunes to one partition (Law 8). Returns metadata only (ids/action/reason/ip/
  request_id) — never old/new value blobs.
- **Retention admin** over `data_retention_policies` (0015): per-table active/archive months + legal basis +
  action (archive/anonymise/delete/keep_forever), bounds-validated, audited. The retention worker enforces it.
- **Breach console** over `data_breaches` (0034): DPDP §8 lifecycle `open→contained→notified→closed`; `notify`
  requires BOTH regulator + data-principal notification timestamps. Stores affected-data **categories** only.

## Threats considered (§4 + DPDP)
- **No PII leak.** The breach record stores affected-data CATEGORIES (e.g. `phone,email`), never raw values; the
  audit explorer returns metadata only; DSR rows reference uuids + admin-written resolutions. Audit-log payloads
  are PII-free by writer contract.
- **No privilege escalation (Law 11).** `compliance.manage`/`compliance.read` are PLATFORM owner perms (roles
  `platform_compliance_ops`/`platform_compliance_viewer` = DPO/auditor); never tenant-assignable, no plane bleed
  (unit-tested).
- **JIT elevation + audit.** Every mutation needs a verified admin JWT + the owner perm + FIDO2 hardware-key +
  step-up; guards THROW. Each DSR/export/retention/breach change writes an `audit_log` row IN THE SAME TX
  (actor, old→new, reason, ip, request_id); illegal transitions / already-decided exports write nothing.
- **DPDP guards.** Erasure honours the 90-day cooling window; the export approval gate prevents un-reviewed
  mass-PII egress; `notify` enforces dual-notification (regulator + principals, DPDP §8).
- **Fail closed / bounded.** Typed 404s on missing entities; zod `.strict()` DTOs reject unknown keys; audit
  filters are charset/length-bounded (ReDoS/injection-safe), parameterised SQL only; keyset pagination
  (never OFFSET), max LIMIT 100, mandatory reason on every mutation.

## Tests
- Unit (`compliance-ops.spec.ts`): DSR + breach state machines, erasure-cooling guard, export-approval guard,
  owner-RBAC + no-escalation, DTO validation (incl. audit-filter regex safety), services audit-in-tx + 404 +
  notify-dual-timestamp.
- Integration (`compliance-ops.integration.spec.ts`, real Postgres, gated on `DATABASE_ADMIN_URL`): work a DSR to
  completion; approve an export job; open→contain→notify→close a breach — asserting state, `audit_log` rows, the
  approval columns, and that affected-data categories (not values) are stored.
