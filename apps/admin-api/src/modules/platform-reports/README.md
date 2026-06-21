# platform-reports (admin-api · god-mode plane, Law 11)

Read-only **exec dashboards** — the platform-wide rollups a founder/board/finance team needs: MRR/ARR, GMV +
platform take, active tenants by lifecycle, active users + login success, tenant growth, and a PII-free regulator
export. Pure reads over EXISTING data (no new schema, no writes, no money movement). Cross-tenant by design —
admin-api's `kv_admin` bypasses RLS for the platform aggregate.

## Endpoints (URI-versioned, all admin-authed, `reports.read`)
| Method | Path | What |
|---|---|---|
| GET | `/v1/reports/overview` | MRR/ARR + active-tenant counts + active users (windowed) + headline GMV |
| GET | `/v1/reports/gmv` | GMV / platform-fee / commission / orders / AOV over a window (optional `tenantId`) |
| GET | `/v1/reports/tenant-growth` | new tenants per month over a window (≤13 buckets) |
| GET | `/v1/reports/regulator-export` | PII-free aggregate snapshot for a period (board/regulator pack) |

All accept optional `from`/`to` (ISO) + `currency`; the window defaults to the last 30 days and is bounded.

## What it owns
- **Revenue** — MRR from `subscriptions` (active+trialing, **annual ÷ 12 floored in SQL**), ARR = MRR × 12. Mirrors
  the plans-ops/billing-ops normalisation so the figure is consistent platform-wide.
- **GMV** — `SUM(orders.total_minor)` (+ platform_fee / commission / count / AOV) over a `created_at` window,
  excluding cancelled, optionally one tenant. The window filter prunes the PARTITIONED `orders` table (Law 8).
- **Tenants** — counts grouped by `tenant_status`, with a derived "active" total (active/trial/grace).
- **Activity** — distinct succeeded-login users + login success rate from `login_events` over the window
  (partition-pruned); success rate is **integer basis points**.
- **Tenant growth** — new tenants per calendar month over the window.
- **Regulator export** — a generated-at-stamped, PII-free snapshot: GMV + take, active/total/new tenants, active
  users — counts + money totals only, no per-user/per-order rows.

## Threats considered (§4 + §5)
- **No privilege escalation (Law 11).** `reports.read` is a PLATFORM owner perm (role `platform_reports_viewer`);
  read-only, never `*`, never money/god/manage, never tenant-assignable (unit-tested). There is no mutation
  endpoint — nothing consequential happens, so no hardware-key/step-up (the @Global interceptor access-logs reads).
- **Money correctness (Law 2).** Every monetary figure is **bigint minor units surfaced as a string** (SQL
  `SUM(...)::text`); no JS float ever touches a money value. Ratios/averages are integer basis points / floor
  bigint.
- **Bounded scans (§5 / DoS).** Every windowed query is capped at a **366-day** range (validated in
  `resolveWindow` → 422 on backwards/oversized/invalid), and time filters prune the partitioned `orders` /
  `login_events` tables — a single dashboard call can't table-scan all history. Tenant growth is bounded to ≤13
  monthly buckets.
- **Anonymised / PII-free.** Outputs are aggregates only (counts + money totals + status breakdowns). No user/
  order/PII rows are returned; the regulator export is explicitly `piiFree: true`.
- **Cross-tenant is intentional + role-gated.** This is the god-mode reporting plane; `kv_admin` bypasses RLS to
  roll up across tenants, gated behind the platform `reports.read` perm — a tenant can never reach it (Law 11).
  Parameterised SQL only.

## Tests
- Unit (`platform-reports.spec.ts`): float-free metric math (MRR/ARR, basis-point ratios, AOV); window validation
  (forward + bounded); owner-RBAC + no-escalation/no-`*`; DTO validation; services composing the read-model
  (money stays bigint-string, ratios stay bps; regulator export PII-free).
- Integration (`platform-reports.integration.spec.ts`, real Postgres, gated on `DATABASE_ADMIN_URL`): every
  aggregate SQL executes cross-tenant (RLS bypassed) and returns the right shapes — money as integer minor-unit
  strings, counts as numbers; the windowed/partition-pruned queries run.
