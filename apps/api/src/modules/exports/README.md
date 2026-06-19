# Exports & GI (M23) — agri-export compliance + documentation

The export workflow: register your RCMC/IEC, create a shipment to a destination country, assemble the
mandatory document checklist (BoL, commercial invoice, packing list, CoO, phyto…), and drive the shipment
through its lifecycle — with a hard gate that it cannot **ship** until every document is verified. Country
compliance rules are browsable reference data. Built to the platform laws. Gated by the **`exports`** flag (default OFF).

## No in-platform money path (by design)
Export settlement is via **Letter of Credit / bank** (external). `total_value_minor` is **informational**
(the LC value, bigint minor units), and the `paid` status merely records that the LC/bank payment was
confirmed out-of-band. No wallet movement occurs in this module — like offers/requirements/reviews.

## Lifecycle (Law 5 — `domain/*.state.ts`)
- **Shipment**: `draft → docs_in_progress → inspection → shipped → delivered → paid → closed` (linear).
- **Document**: `pending → submitted → verified | rejected` (rejected → submitted on resubmit).
- **The compliance ship-gate**: advancing a shipment to `shipped` requires it to have **≥1 document and
  every document verified** (enforced in the service via `countNotVerified`), else `EXPORT_DOCS_NOT_CLEARED`.
- No version columns → mutations lock **FOR UPDATE**.

## Endpoints
- `POST /v1/exports/exporters` (idempotent, `export.manage`) · `GET` (?box=mine|all) · `GET /:id` · `PATCH /:id`
  · `GET /exporters/compliance?destinationCountry=&categoryId=` (read-only reference data).
- `POST /v1/exports/shipments` (idempotent, `export.manage`) · `GET` (?box) · `GET /:id` · `POST /:id/advance`.
- `POST /v1/exports/shipments/:shipmentId/documents` (add) · `GET …/documents` · `POST /exports/documents/:id/status`.

## Threats considered
- **No cross-party IDOR**: exporter registrations / shipments / documents read 404 for non-owners; document
  ops resolve the parent shipment's exporter; `box=all` requires `booking.manage`.
- **Compliance rules are read-only here**: `compliance_requirements` is GLOBAL reference data authored on the
  admin/platform surface (Law 11) — the tenant API only browses it (effective-dated, by destination).
- **Anti-mass-assignment**: zod `.strict()` DTOs; `doc_type_id` resolved from the platform `export_doc`
  lookup (`tenant_id IS NULL`), never client-supplied; IEC normalized to 10 alphanumerics.
- **Compliance integrity**: the docs-cleared gate prevents shipping uncleared cargo (fail closed); audit row
  on every shipment progression.
- **AuthZ throws**: `export.manage` (exporter/admin) on writes; tenant_id + RLS everywhere (integration proves
  cross-tenant denial); keyset pagination with max `LIMIT`.

## Events (outbox, Law 4)
`exports.exporter_registered/updated`, `exports.shipment_created/progressed`, `exports.document_added/status_set`.

## Scope & deferrals
**In scope:** exporter registrations, export shipments (lifecycle + docs-cleared ship gate), document checklist, read-only compliance browse.
**Deferred (schema in 0010 / admin surface):** authoring `compliance_requirements` (platform/admin, Law 11),
RCMC-expiry + doc-checklist reminder jobs, mandatory-doc-set templating per destination, DGFT/ICEGATE +
repository API integrations, GI (Geographical Indication) tagging.

## Tests
- `__tests__/exports-domain.spec.ts` — shipment + document state machines, aggregate invariants.
- `__tests__/export-shipment.service.spec.ts` — the docs-cleared ship gate (blocks while unverified/empty, allows when all verified).
- `__tests__/exporter-registration.service.spec.ts` — register outbox + authz; owner-only edit.
- `__tests__/tenant-isolation.spec.ts` — SQL contract (tenant_id, FOR UPDATE, keyset, platform-scoped export_doc lookup, global compliance read).
- `__tests__/exports.integration.spec.ts` — real Postgres: register → shipment → docs → **ship gate** → delivered → paid → closed → RLS.

> No Postgres in the sandbox, so the live RLS / ship-gate assertions run on the first CI run with a service container.
