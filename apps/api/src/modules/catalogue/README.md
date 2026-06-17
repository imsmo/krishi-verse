# catalogue module (PRD M02)

The dynamic catalogue: the category taxonomy, typed attributes, and the product master
("the thing") that `listings` ("the offer") references. Built to the `listings`/`identity` bar.

## What it owns (tenant-facing surface)
- **Categories** — browse the global 5-level taxonomy (ltree), and enable/disable branches for
  the tenant's own storefront (`tenant_categories`).
- **Attributes** — resolve the typed attributes (with options) that apply to a category,
  **including inherited ones from ancestor categories** (ltree `path @>`), for forms + search facets.
- **Products** — browse/search (platform-master + the tenant's own), and create/update/deactivate
  the tenant's **own private** products with validated typed attribute values.
- **Product batches** — regulated-input store inventory (expiry, FIFO consume, recalls), gated by
  the `product_batches` feature flag.

## Security properties (threats considered)
- **Tenant isolation**: products are hybrid — `tenant_id NULL` = platform master (read-only here),
  set = tenant-private. RLS enforces `tenant_id IS NULL OR tenant_id = current_tenant_id()`, and
  every query also binds it (Law 1). Writes only ever touch the caller's OWN products
  (`getForUpdate` is tenant-scoped + `FOR UPDATE`). Proven by the integration test (tenant B cannot
  see tenant A's private product; both see the platform master).
- **No platform escalation (Law 11)**: GLOBAL taxonomy writes (categories, attribute defs/options,
  platform products, brands, templates, regulated rules) are **NOT** exposed here — they belong to
  apps/admin-api. This module only does reads + tenant-scoped writes.
- **Input validation**: zod `.strict()` DTOs; submitted attribute values are validated against their
  definitions (type, min/max, regex, allowed option ids) before persistence — an attacker can't
  inject an out-of-range or unknown-option value.
- **Idempotent** create (per-user scoped key); **audit** on batch recall; **metrics** on every
  use-case; **cursor** (keyset) pagination only; **bounded** lists; reads on the **replica** (CQRS).
- Money (`mrp_minor`) is `bigint` minor units; never float.

## Endpoints
`GET /v1/categories` (tree) · `POST /v1/categories/tenant-toggle` (configure) ·
`GET /v1/attributes?categoryId=` · `GET /v1/products` (search) · `GET /v1/products/:id` ·
`POST/PATCH /v1/products[/:id]` · `POST /v1/products/:id/deactivate` ·
`GET/POST /v1/product-batches`, `POST /v1/product-batches/:id/recall` (flag: `product_batches`).

## Tests
Unit: product invariants + lifecycle, attribute typed validation, batch consume/recall/expiry,
tenant-isolation SQL contract. Integration (`catalogue.integration.spec.ts`, real Postgres + RLS):
create tenant product → outbox + search visibility, platform-master visibility, idempotency,
batch recall + audit, cross-tenant RLS denial. Slice SQL: `apps/api/test/sql/catalogue_slice.sql`.

## Deferred (flagged, not faked) — Phase 2 / admin-api
Global taxonomy CRUD (admin-api), certificates (organic/GI — overlaps KYC, organic phase),
regulated-product-rule enforcement at listing time (Phase 2 hook), attribute templates & brands
write, OpenSearch relevance search (Phase 2; current search is replica `search_tsv` + ILIKE).
