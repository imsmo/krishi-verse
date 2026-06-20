# traceability (PRD §16.3) — farm-to-fork QR

A traceable produce lot carries a public QR; the supply-chain journey is recorded as a tamper-evident
hash chain; a consumer scans the QR (no login) and sees the provenance. Money-free. Gated by the
`traceability` feature flag (default **OFF**).

## What it owns

- **Trace lots** (`trace_lots`, tenant-scoped) — a lot tied to a listing, owned by a farmer, with declared
  inputs + certificate refs. `qr_token` is a 32-char unguessable **public capability**; `blockchain_anchor` is
  the Phase-2 tamper anchor (set to the chain head by the anchor job).
- **Trace events** (`trace_events`, PARTITIONED by `created_at`, append-only) — the journey
  (`harvested → listed → sold → packed → picked → in_transit → delivered`, + `recalled`). Each event is
  **hash-chained**: `event_hash = sha256(prevHash ‖ lotId ‖ eventCode ‖ meta)`, genesis chaining off the lot id.
  Tampering any link breaks every subsequent hash — verifiable provenance.

## Flows

- **Read provenance is universal.** The public scan needs **no role and no login at all** — any authenticated
  role *and* anonymous consumers can read a lot's farm-to-fork journey from its QR. Traceability is **not**
  "farmer + admin only"; only *authoring* is gated.
- **Author** (`trace.manage`): `create` a lot (Idempotency-Key; seeds a genesis event) and `append` journey
  events (each chained off the previous hash under a `FOR UPDATE` lock on the lot so the chain head is stable).
  Authoring is least-privilege (§4 / Law 6): held only by roles that physically own/produce a saleable lot —
  **farmer, pashupalak, dairy_farmer, vyapari, organic_store, pharma_store, fpo_coordinator** (+ `tenant_admin`).
  Buyers/handlers (customer, delivery_partner, vet, banker, ambassador, …) cannot fabricate provenance; the
  in-transit/delivered legs are intended to arrive from the deferred logistics-outbox fanout, not manual entry.
- **Public scan** (NO auth): `GET /v1/traceability/scan/:qrToken` returns a curated provenance projection via
  the **`SECURITY DEFINER` `trace_scan()` function** (migration 0028) — the single controlled RLS-bypass path.
  It returns only `qrToken / listingId / declaredInputs / certificateIds / anchored / events[]` — **never**
  `tenant_id`, the farmer's user id / phone, or any PII. Flag-gated (404 when off), token-format validated.
- **Anchor job** (worker, BYPASSRLS) stamps each un-anchored lot's `blockchain_anchor` with its chain head.

## Threats considered (§4)

- **Tenant isolation / RLS** — `trace_lots` + `trace_events` are RLS-protected; `tenant_id` binds every
  authenticated query. The public scan can't read tables directly (RLS hides everything with no tenant context)
  — it goes only through `trace_scan()`, which is `REVOKE`d from PUBLIC and `GRANT EXECUTE`d to `kv_app`.
- **Public endpoint** — the capability is the unguessable token (no enumeration; anchored-regex format check);
  the projection is fixed and **non-PII** (no tenant id, no user id/phone). Flag-gated, fail-closed.
- **No IDOR** — authenticated reads are owner-or-`trace.manage` (404 for a stranger). Authoring is
  `trace.manage`-only.
- **Integrity** — append-only hash chain makes the journey tamper-evident; the anchor pins the chain head.
- **Scale** — events list is keyset (never OFFSET); event queries bound the lot so PG prunes partitions (Law 8).

## Deferred (schema present, not built)

Auto-population of journey events from `orders`/`logistics` outbox events (those payloads don't yet carry
`listing_id`; the `appendForListing()` hook is ready for when they do); on-chain anchoring (the local chain-head
anchor is wired); recall/withdrawal workflow.

## Tests

`__tests__/traceability-domain.spec.ts` (hash chain determinism + tamper detection, lot lifecycle),
`trace-lot.service.spec.ts` (create authz + genesis, chained append, 404 IDOR, idempotent fanout hook),
`tenant-isolation.spec.ts` (CI gate: tenant binding, FOR UPDATE, keyset, public scan routes through
`trace_scan()` not a raw read), `traceability.integration.spec.ts` (real Postgres + 0028: create → chained
journey → public scan returns no PII → unknown-token 404 → cross-tenant RLS denial; runs when `DATABASE_URL` is set).
