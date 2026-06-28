# P2 — Phase-2 verticals (post-launch roadmap)

These are the PRD's **Phase-2** capabilities. They do **not** block go-live. Most have backend modules already
built (the mobile route groups / one missing module are what's left). Do these after a stable GA, prioritised by
the verticals your launch tenants demand. **Paste `00-PRODUCTION-CONTRACT.md` above each task.**

---

### P2-1 · Insurance module (the one genuinely-absent backend)
- **Track:** `apps/api` (new `insurance` module) + `wallet-service` + SDK + `web-partner` + `apps/mobile` (worker
  PMSBY) + `web-tenant`
- **Why pending:** **BLOCKED — there is no `insurance` module in `apps/api`.** This blocks partner insurance
  (policies/claims), worker PMSBY enrol/claim, and any farmer insurance surface. The canonical schema has insurance
  tables (`10_fintech_schemes.sql`); they're implemented but no module drives them end-to-end.
- **Scope:** Build a full insurance module to the `listings` reference bar: policy products (IRDAI-partner-gated),
  enrolment, premium collection (ledger-only money), claims state machine, payouts. Then wire the partner
  policies/claims UI, worker PMSBY screens, and any farmer surface. This is a **multi-wave** effort — split into
  domain/dto/repo/service/controller, then claims, then each client.
- **Done when:** A policy can be sold, premium collected through the ledger, a claim filed → adjudicated → paid; all
  three clients un-flagged; full test + RLS coverage.

### P2-2 · Mobile role app — Dairy / MCC operator
- **Track:** `apps/mobile` `(dairy)` route group (backend dairy module already built)
- **Why pending:** Phase-2; backend modules built but no `(dairy)` route group wired.
- **Scope:** MCC membership, milk collection entry, rate-cards, cycle billing screens on the existing mobile shell
  (flags default-OFF, i18n parity, no apiClient in screens).
- **Done when:** A dairy operator runs a collection cycle end-to-end on mobile.

### P2-3 · Mobile role app — Livestock + Vet
- **Track:** `apps/mobile` `(livestock)` / `(vet)` route groups (backend built)
- **Scope:** Animal records/health events + vet booking state machine screens.
- **Done when:** An animal health event + vet booking complete on mobile.

### P2-4 · Mobile role app — Delivery partner (rider)
- **Track:** `apps/mobile` `(delivery-partner)` route group (logistics backend built)
- **Scope:** Rider queue, proof-of-pickup/delivery (OTP + photo), cold-chain compliance, shipment lifecycle.
- **Done when:** A rider completes an OTP-gated delivery on mobile.

### P2-5 · Mobile role app — Store owner
- **Track:** `apps/mobile` `(store-owner)` route group (backend built)
- **Scope:** Store inventory/listing management screens for an agri-input store operator.
- **Done when:** A store owner manages inventory + orders on mobile.

### P2-6 · Mobile role app — Fintech (loans/insurance, farmer-facing)
- **Track:** `apps/mobile` `(fintech)` route group (fintech backend built; insurance depends on P2-1)
- **Scope:** Farmer-facing loan application + repayment screens; insurance surfaces once P2-1 lands.
- **Done when:** A farmer applies for a loan and tracks repayments on mobile.

### P2-7 · Mobile role app — Vyapari / FPO extras
- **Track:** `apps/mobile` `(vyapari)`/FPO route group (backend built)
- **Scope:** Market dashboard, requirements inbox, supplier shortlist, group-lots.
- **Done when:** An FPO/vyapari runs a group lot + requirements flow on mobile.

### P2-8 · IVR / USSD voice channel (non-smartphone farmers)
- **Track:** `apps/ivr-ussd-gateway` (scaffold exists) + telephony provider
- **Why pending:** Needs a telephony provider (Asterisk/Twilio); skipped for local. PRD Phase-2 (USSD is Phase-3).
- **Scope:** Wire the IVR/USSD gateway to a telephony provider behind a resilience port; core flows (listing,
  prices, OTP) over voice/keypad in vernacular.
- **Done when:** A feature-phone user completes a core flow over IVR.

### P2-9 · WhatsApp bot channel
- **Track:** `apps/whatsapp-bot` (scaffold exists) + WhatsApp Business API
- **Scope:** Wire the bot to the WhatsApp Business API behind a resilience port; notifications + simple commerce
  flows; consent + opt-out.
- **Done when:** A user receives notifications and runs a simple flow over WhatsApp.

### P2-10 · ONDC / GeM integration
- **Track:** `apps/api` (new adapter) + SDK
- **Why pending:** PRD Phase-2 — government/network procurement interoperability, not yet built.
- **Scope:** ONDC protocol adapter (catalogue/order/fulfilment mapping) behind a resilience port; GeM procurement
  adapter.
- **Done when:** A listing is discoverable + orderable via ONDC in a sandbox.

### P2-11 · AI dispute-triage assistant + demand forecasting + route optimization + inventory-expiry prediction
- **Track:** `apps/ai-services` + `apps/api` (disputes / market-intel / logistics / warehousing) + SDK
- **Why pending:** PRD Phase-2 AI/ops capabilities; ai-services serving exists but these specific models/flows
  aren't built.
- **Scope:** Per capability: a governed ai-services model + the consuming endpoint/job. One capability per wave.
- **Done when:** Each shows a measurable, logged improvement behind its flag (e.g. dispute triage time, forecast
  accuracy) without faking outputs.

### P2-12 · Self-serve tenant onboarding + white-label (trial plans, custom domains, branding)
- **Track:** `apps/api` tenancy-self-serve (built) + `web-tenant`/marketing + DNS automation
- **Why pending:** Backend self-serve module exists; the public sign-up → trial → branded-domain flow isn't fully
  wired end-to-end.
- **Scope:** Public tenant sign-up, trial plan provisioning, custom-domain verification + TLS, branding apply.
- **Done when:** A new tenant self-onboards to a branded domain on a trial plan without manual ops.

### P2-13 · Tree hygiene: delete orphaned scaffold stubs (`export {}`)
- **Track:** all (`apps/*`, `packages/*`)
- **Why pending:** Surfaced by the P1-18 GA sweep. ~335 files still carry the original generator skeleton
  (`// TODO: implement per CLAUDE.md laws` + `export {};`). Every sampled one is **dead code** — superseded by a
  real implementation at a sibling path and imported by nothing (verified: the `apps/wallet-service/src/payments/*`
  and `payouts/*` stubs have zero inbound imports; the real money path is `apps/api/.../payments/gateway` +
  `payment-webhooks.controller`; the `apps/api/src/core/{rbac,quota,idempotency,database}` stubs sit beside their
  live `*.pg.ts` / `permissions.guard.ts` implementations). Not GA-blocking (cannot affect build or runtime), but a
  maintainer trap (someone could wire the wrong file) and it contradicts a "clean tree" claim.
- **Scope:** Mechanically delete the `export {}`-only stub files after re-confirming each has zero inbound imports
  (a simple `rg` import check per file); keep any that a barrel actually re-exports. No behaviour change.
- **Done when:** `rg "TODO: implement per CLAUDE.md" apps packages` returns only intentionally-deferred `[P2]`/`[P3]`
  placeholders (or zero), and typecheck/build stay green.

> P2 is a menu, not a gate. Ship the verticals your market pulls. Next: **P3** (scale + Phase-3).
