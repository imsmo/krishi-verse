# ADR-0001: Monorepo + Modular Monolith + 3 satellite services
Status: Accepted (June 2026)
Decision: One pnpm/turbo monorepo. Core API is a NestJS modular monolith whose
modules map 1:1 to PRD modules. Three things run separately from day 1:
wallet-service (money isolation), worker (queue consumers), outbox-relay.
Why not microservices day 1: 6-person team, 9-month MVP (Survival Guide).
Why not pure monolith: money isolation is non-negotiable; extraction recipe
must be proven from day 1.
Extraction recipe (Phase 2/3): move modules/<x> → apps/<x>-service, expose the
same contract from packages/contracts, route via gateway. No rewrites.
