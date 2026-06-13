# Per-Module Build Ticket (one per module — drop into Linear/Jira/GitHub Issues)

**Module:** [name]   **Wave:** [0/1/2/3]   **Effort:** [S/M/L/XL]   **PRD:** [Mxx]
**Depends on (must be built first):** [modules]
**DB tables:** [from db/migrations/...]
**Screens served:** [from docs/architecture/module-map.md]

## Definition of Done (every box ticked before merge)
- [ ] domain entities + state machine (95% unit coverage on domain)
- [ ] repository (tenant-scoped, shard-routed, read/write split)
- [ ] services (txn+outbox, idempotency, quota where relevant)
- [ ] read-models for list/search/dashboard paths
- [ ] controllers v1 (thin) + DTO validation (zod from packages/contracts)
- [ ] event handlers (idempotent) + outbox publishers
- [ ] jobs registered in apps/worker
- [ ] policies (permission codes seeded in db/seeds/core/0004)
- [ ] tenant-isolation.spec passes (CI gate)
- [ ] e2e for each endpoint
- [ ] i18n keys added (hi/en/gu)
- [ ] feature flag wired, default OFF
- [ ] OpenAPI annotations → packages/contracts
- [ ] events documented in packages/contracts/src/events/[domain].events.ts
- [ ] CODEOWNERS review if it touches money/migrations

## Acceptance (functional)
[copy the relevant acceptance criteria from PRD §40 for this module's Mxx]
