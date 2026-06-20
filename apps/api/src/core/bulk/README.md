# core/bulk — bulk CSV import (core platform)

Generic, tenant-safe machinery to import large CSVs (products, listings, …) row-by-row. **No business logic
lives here** — what each row *means* is owned by a registered **applier**; core/bulk just runs the job
lifecycle, parses the CSV, applies each row through the applier, and records results. Gated by the `bulk_import`
feature flag (default OFF); `bulk.import` permission (tenant_admin).

## Flow

1. Operator uploads the CSV via the media presign flow, then `POST /v1/bulk-imports` with `{ importType,
   storageKey }` (+ optional `columnMapping`, Idempotency-Key). A `bulk_import_jobs` row is created (`pending`).
2. The worker (`jobs/process-pending.job.ts`, BYPASSRLS sweep, `FOR UPDATE SKIP LOCKED`) hands each pending job
   to `BulkImportProcessor.process()`, which: **claims** it (`pending→processing` under a row lock) → fetches
   the CSV from the object store (resilience-wrapped) → **parses** it (bounded RFC-4180) → validates the
   applier's `requiredColumns` (missing ⇒ the whole job `failed`) → applies each row through the applier with a
   **deterministic per-row idempotency key** (`bulkrow:<jobId>:<rowIndex>`) → records per-row failures (capped at
   1000) → **finishes** (`completed` / `partially_completed` / `failed`).
3. `GET /v1/bulk-imports/:id` shows live counts; `GET /:id/errors` pages the per-row failures; `POST /:id/cancel`
   aborts a pending/processing job.

## Extension point

Modules register a `BulkRowApplier` into the global `BulkApplierRegistry` (mirrors the outbox-handler pattern):

```ts
onModuleInit() { this.bulkRegistry.register(this.productApplier); }  // catalogue → import_type 'products'
```

An applier declares `importType` + `requiredColumns` and an idempotent `applyRow()` that maps the row → the
module's existing create DTO and calls the module's service — so **every imported row gets the same validation,
quota, tenant-scoping, outbox + idempotency as a single API create** (no parallel write path). The shipped
`products` applier delegates to `ProductService.create`.

## Threats considered (§4)

- **Tenant isolation / RLS** — `bulk_import_jobs` + `bulk_import_errors` are RLS-protected and bind `tenant_id`
  in every query; the processor works the job under the job's tenant; cross-tenant denial is proven in the
  integration test. The worker sweep uses the BYPASSRLS relay pool only to *find* pending job ids.
- **No IDOR** — reads are tenant-scoped (404 for a non-member).
- **DoS / write-amplification** — the parser is bounded (max rows / fields / cell length); recorded errors are
  capped at 1000 per job (the failed-count stays accurate beyond that); active jobs per tenant are capped (5);
  every list is keyset + `LIMIT`. Object-store I/O is resilience-wrapped (timeout + breaker).
- **Idempotency** — create is idempotent (Idempotency-Key); each row carries a deterministic key so a re-run /
  crash recovery never double-creates. The claim (`pending→processing`, `FOR UPDATE`) stops double-processing.
- **Input validation** — the applier validates each row with the SAME strict zod schema the API uses; a bad row
  is a recorded per-row failure, never a thrown 500 that aborts the file.
- **Audit** — create + cancel write an `audit_log` row in the same tx.

## Deferred

Stale-`processing` job recovery (a sweeper that resets jobs stuck in `processing` past a timeout back to
`pending` for re-claim); resumable mid-file restart from `processed_rows` (today a re-run is safe via the per-row
idempotency key but re-walks the file); CSV column auto-detection. Worker registration of the sweep job mirrors
the other relay jobs.

## Tests

`__tests__/bulk-import.spec.ts` (CSV parser incl. quotes/CRLF/bounds, job state machine, applier registry,
processor claim→apply→error-capture→terminal-status); `tenant-isolation.spec.ts` (CI gate: tenant binding, FOR
UPDATE, keyset); `bulk-import.integration.spec.ts` (real Postgres + 0030: create → process 2-ok-1-fail →
partially_completed + one recorded error → cross-tenant RLS denial; runs when `DATABASE_URL` is set).
