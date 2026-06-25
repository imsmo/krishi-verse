# DPDP compliance dossier (P0-7)

Maps India's DPDP obligations to the built machinery, with the exact endpoints/jobs/tables, so the
data-protection sign-off is a verification — not a discovery. Endpoints are versioned under `/v1`.

> **Honest gap (flagged):** the request-handling + cooling-off + retention **logic is built** (in `apps/api`), but
> the `apps/worker` **runtime host that runs them on a schedule is a scaffold** (every file a stub). So the async
> completion steps (export-file generation, erasure after cooling-off, retention purge) won't fire until the
> **worker-runtime** build lands. Tracked as P0-9 in the backlog. Synchronous request intake + audit work today.

---

## 1. Consent (purpose-based, append-only)
- **Capture/read:** `GET /v1/consents`, `POST /v1/consents` (`consents.controller` → `consent.service`).
- **Store:** append-only consent records (`consents`, migration 0003) — never overwritten; withdrawal is a new row.
- **Purposes:** seeded in `db/seeds/core/0006_consent_purposes.sql`.
- **Audit:** every grant/withdraw writes `audit_log` in the same tx.

## 2. Data-subject requests — access / portability / erasure (DPDP §11–12)
- **Export (access/portability):** `POST /v1/privacy/export-requests` → queues a `data_export_jobs` row
  (`job_kind='user_dpdp_export'`); the export bundle is produced by the worker, downloadable via a TTL'd media link.
- **Deletion/erasure:** `POST /v1/privacy/deletion-requests` → opens a `data_subject_requests` row
  (`request_type='erasure'`) with a **90-day cooling-off** (`cooling_ends_at`).
- **Status:** `GET /v1/privacy/requests` (subject-scoped; token-resolved, no IDOR).
- **Cooling-off → erasure:** `dpdp-erasure-cooling.job` advances `open` erasure requests whose `cooling_ends_at`
  has elapsed to `in_progress` for the erasure pipeline. *(Runs on the worker — see gap above.)*
- **Admin oversight / approvals:** admin-api `compliance-ops` (migration 0034) governs DSR + breach workflows.

## 3. PII minimisation & masking (DPDP §8)
- Aadhaar/PAN/bank are **never** stored raw — only vault refs + last-4, masked in every response (enforced in
  the identity/kyc/payouts code; covered by module unit suites). Verified by `app-config.security` (no static
  keys) + the masking guarantees in the KYC/bank flows.
- PII / OTP / tokens are **never logged** (proven for SMS by `sms-provider.spec.ts`; structured logs carry
  `request_id` only).

## 4. Retention (DPDP storage-limitation)
- **Policy table:** `data_retention_policies` (migration 0015) — per-table `active_months` / `archive_months` /
  `legal_basis` / `action` (archive|anonymise|delete|keep_forever). Examples: GST 7yr, RBI 10yr, DPDP minimisation.
- **Enforcement job:** `retention-enforcer` purges/anonymises per policy. **(Currently a worker stub — flagged.)**
- **Partition archival:** time-partitioned tables roll to S3 parquet via the archive-partitions job.

## 5. Breach notification (DPDP §8(6))
- `data_breaches` (migration 0034) + admin-api `compliance-ops` breach state machine. Runbook:
  `ops/runbooks/tenant-leak-suspected.md` (detection → contain → notify Data Protection Board + affected users).

## 6. Live verification (run against a real account)
`db/prod/dpdp-verify.sh` exercises the subject-facing flow end-to-end:
request an export → confirm a `data_export_jobs` row → request deletion → confirm an erasure DSR with a
cooling-off date → read status. (Async completion is worker-dependent — the script notes this.)

## Sign-off checklist (record date + signer)
- [ ] Consent capture + withdrawal verified (append-only).
- [ ] Export + deletion requests accepted; DSR rows + cooling-off correct.
- [ ] No raw Aadhaar/PAN/bank in any response or log (sampled).
- [ ] Retention policies seeded with legal bases; **enforcement job running** (needs worker-runtime).
- [ ] Breach runbook rehearsed; DPB notification path identified.
- [ ] Data-protection officer / legal sign-off recorded here.
