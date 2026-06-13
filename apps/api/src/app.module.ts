// apps/api/src/app.module.ts · ROOT WIRING — every core + business module registered here · [P1]
// Order matters: core plumbing first, then business modules. A module not
// imported here does not exist at runtime — this file IS the tree's trunk.
//
// core:    config, database (RLS session), tenancy-context, auth, rbac, i18n,
//          cache, idempotency, outbox, audit, media, search, feature-flags,
//          quota, http (filters/interceptors), health
// modules: tenancy, identity, catalogue, listings, auctions, offers,
//          requirements, orders, disputes, reviews, promotions, memberships,
//          payments, logistics, labour, livestock, dairy, equipment,
//          warehousing, contract-farming, exports, land-soil-weather,
//          fintech, schemes, education, communication, cms, support,
//          ambassadors, services-marketplace, market-intel, ai-governance,
//          traceability
// TODO: convert comment list to actual imports as each module is implemented.
export {};
