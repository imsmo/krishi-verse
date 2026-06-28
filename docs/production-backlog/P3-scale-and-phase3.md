# P3 — Scale-triggered infra + Phase-3 moonshots (do when the metric demands it)

Nothing here blocks launch. The scale items (P3-1…P3-3) are the three remaining `⬜` MODULE_STATUS rows — they are
**deliberately not "done" because they're config/execution that you turn on when load crosses a threshold**, not
gaps. The Phase-3 items (P3-4…P3-11) are the PRD's long-horizon bets. **Paste `00-PRODUCTION-CONTRACT.md` above
each code task.**

---

## Scale-triggered infrastructure (the 3 remaining ⬜ rows)

> These are already wired as **routers at `count=1`** so turning them on is config, not a rewrite (Law 12). Build
> the execution path **before** you actually need it, but only invest once growth is real.

### P3-1 · Backpressure classification end-to-end
- **Track:** `apps/api` core/backpressure + gateway
- **Why pending (not a gap):** The classifier exists; full end-to-end load-shedding (critical paths survive while
  sheddable traffic drops) is verified only under real overload, which needs cluster load.
- **Trigger:** When p99 latency or error rate climbs under peak load.
- **Scope:** Finish wiring request classification (pay/wallet/auth/bid = critical) through the gateway + API so
  overload sheds low-priority traffic first; prove it under a load test.
- **Done when:** Under induced overload, critical paths hold SLO while sheddable traffic is dropped gracefully.

### P3-2 · Shard execution (split beyond shard_count=1)
- **Track:** `db/` + `apps/api` shard router + `admin-api` cells-ops
- **Why pending (not a gap):** Writes already route through the shard router at `SHARD_COUNT=1`; the actual data
  split + rebalance tooling is exercised only when one shard gets hot.
- **Trigger:** When the primary's write volume / size approaches limits.
- **Scope:** Implement + rehearse the shard-split (online resharding, tenant placement, backfill, cutover) using the
  existing router; verify zero cross-shard correctness loss.
- **Done when:** A rehearsed split moves tenants to a new shard with no downtime and balanced load.

### P3-3 · Cells execution (cell-based isolation/placement)
- **Track:** `admin-api` cells-ops (built) + `infra` + `apps/api` cell router
- **Why pending (not a gap):** cells-ops module + cell_map exist; placing/evacuating real cells is an ops execution
  exercised at multi-region scale.
- **Trigger:** Blast-radius isolation needs or multi-region growth.
- **Scope:** Stand up a second cell; rehearse tenant placement + evacuation via cells-ops; route traffic by cell.
- **Done when:** A tenant is placed in a cell and evacuated to another with traffic correctly routed and isolated.

---

## Phase-3 moonshots (PRD 2027–2030 horizon)

### P3-4 · Computer-vision pest / disease detection
- **Track:** `apps/ai-services` (CV model) + `apps/api` + `apps/mobile`
- **Scope:** Leaf-photo → diagnosis + vernacular treatment, governed + logged, behind a flag.
- **Done when:** A photo returns a logged diagnosis with safe degrade when unsure.

### P3-5 · Satellite-based farm verification
- **Track:** `apps/api` land-soil-weather + external satellite/GIS provider + `apps/ai-services`
- **Scope:** Verify farm size/crop from satellite imagery (PostGIS), reducing paper-proof friction; provider behind
  a resilience port.
- **Done when:** A parcel is verified from imagery and the result feeds eligibility.

### P3-6 · Blockchain traceability anchoring
- **Track:** `apps/api` traceability (hash-chain already built) + anchor provider
- **Why pending:** The internal hash-chain + anchor job exist; external-chain anchoring is the future step.
- **Scope:** Anchor the existing trace hash-chain to an external ledger behind a resilience port; expose proof on
  the public `/trace` page.
- **Done when:** A trace lot's chain is externally anchored and independently verifiable.

### P3-7 · AI negotiation assistant + generative marketing
- **Track:** `apps/ai-services` + `apps/api` offers/listings + clients
- **Scope:** Data-backed counter-offer suggestions; auto-generated listing descriptions + tenant marketing copy;
  governed + logged.
- **Done when:** Each runs behind a flag with governance logging and no fabricated claims.

### P3-8 · Tenant federation (cross-tenant liquidity)
- **Track:** `apps/api` + admin-api
- **Why pending:** Strict tenant isolation is the current law; federation is a deliberate, carefully-scoped future
  relaxation.
- **Scope:** Opt-in cross-tenant buyer/seller matching + liquidity sharing with explicit consent, audit, and money
  still ledger-only. Must not weaken default isolation.
- **Done when:** Two consenting tenants transact cross-tenant with full isolation preserved for everyone else.

### P3-9 · USSD channel (zero-internet)
- **Track:** `apps/ivr-ussd-gateway` + telephony
- **Scope:** Star-hash short-code flows for zero-internet farmers (extends P2-8).
- **Done when:** A USSD session completes a core flow.

### P3-10 · Multi-country / full i18n (beyond India)
- **Track:** whole platform (`packages/i18n`, money/currency, tax, compliance)
- **Why pending:** Today is India-centric (INR, DPDP, Indian identifiers). Global expansion needs currency, tax,
  locale, and per-country compliance abstractions.
- **Scope:** Multi-currency (ledger already minor-units — add currency dimension carefully), per-country tax +
  compliance, 12+ languages, localized identifiers. This is a large, cross-cutting program.
- **Done when:** A second country runs with its own currency, tax, language, and compliance, isolated from India.

### P3-11 · Family sharing (secondary customer accounts)
- **Track:** `apps/api` identity + clients
- **Scope:** Consent-gated secondary-account access under a primary customer, with scoped permissions + audit.
- **Done when:** A primary grants/revokes a family member scoped access, fully audited.

---

## Final note
The platform was engineered for this roadmap from day one — routers at `count=1`, flags default-OFF, ports for every
external dependency, ledger-only money. That's why P3 is mostly "turn it on + rehearse," not "rebuild." Invest here
on metric triggers and market pull, not on a calendar.
