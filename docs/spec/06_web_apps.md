# Web Apps (tenant, admin, storefront)

118 files. Each row: **path** → layer · what to implement · DB tables · laws · priority.


---
## `web-admin`

### `apps/web-admin/Dockerfile` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-admin/next.config.js` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/web-admin/package.json` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-admin/public/robots.txt` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-admin/src/app/ai-models/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /ai-models: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/ai-review-queue/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /ai-review-queue: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/announcements/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /announcements: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/audit-log/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /audit-log: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys, Law8 partition pruning
- **Priority:** see build plan

### `apps/web-admin/src/app/billing/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /billing: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/cells/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /cells: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/compliance/dsr-queue/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /compliance/dsr-queue: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/dashboard/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /dashboard: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/feature-flags/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /feature-flags: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys, Law10 feature flag
- **Priority:** see build plan

### `apps/web-admin/src/app/global-catalogue/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /global-catalogue: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/global-categories/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /global-categories: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/impersonate/[tenantId]/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /impersonate/[tenantId]: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/layout.tsx` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-admin/src/app/min-wages/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /min-wages: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/moderation/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /moderation: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/plans/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /plans: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/platform-reports/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /platform-reports: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/providers/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /providers: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/providers/sla/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /providers/sla: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/recon-monitor/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /recon-monitor: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/schemes-registry/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /schemes-registry: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/support-tickets/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /support-tickets: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/tenants/[id]/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /tenants/[id]: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/app/tenants/page.tsx` 
- **Layer:** Web Route (web-admin)
- **Implement:** Next.js route for /tenants: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-admin/src/components/data-table.tsx` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-admin/src/features/README.md` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-admin/src/lib/api-client.ts` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-admin/src/lib/auth.ts` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-admin/src/styles/globals.css` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-admin/tsconfig.json` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** Wave 0/1


---
## `web-partner`

### `apps/web-partner/Dockerfile` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-partner/README.md` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-partner/next.config.js` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/web-partner/package.json` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-partner/src/app/api-credentials/page.tsx` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-partner/src/app/claims-queue/[id]/page.tsx` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-partner/src/app/claims-queue/page.tsx` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-partner/src/app/dashboard/page.tsx` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-partner/src/app/disbursals/page.tsx` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-partner/src/app/layout.tsx` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-partner/src/app/loan-queue/[id]/page.tsx` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-partner/src/app/loan-queue/page.tsx` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-partner/src/app/policies/page.tsx` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-partner/src/app/portfolio/page.tsx` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-partner/src/app/settings/page.tsx` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-partner/src/app/sla-report/page.tsx` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-partner/src/lib/partner-auth.ts` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-partner/tsconfig.json` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** general
- **Priority:** Wave 0/1


---
## `web-storefront`

### `apps/web-storefront/Dockerfile` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-storefront/next.config.js` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/web-storefront/package.json` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-storefront/public/robots.txt` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-storefront/src/app/[tenantSlug]/listings/[id]/page.tsx` 
- **Layer:** Web Route (web-storefront)
- **Implement:** Next.js route for /[tenantSlug]/listings/[id]: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-storefront/src/app/[tenantSlug]/page.tsx` 
- **Layer:** Web Route (web-storefront)
- **Implement:** Next.js route for /[tenantSlug]: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-storefront/src/app/about/page.tsx` 
- **Layer:** Web Route (web-storefront)
- **Implement:** Next.js route for /about: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-storefront/src/app/blog/page.tsx` 
- **Layer:** Web Route (web-storefront)
- **Implement:** Next.js route for /blog: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-storefront/src/app/help/page.tsx` 
- **Layer:** Web Route (web-storefront)
- **Implement:** Next.js route for /help: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-storefront/src/app/layout.tsx` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-storefront/src/app/page.tsx` 
- **Layer:** Web Route (web-storefront)
- **Implement:** Next.js route for //: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-storefront/src/app/press/page.tsx` 
- **Layer:** Web Route (web-storefront)
- **Implement:** Next.js route for /press: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-storefront/src/app/pricing/page.tsx` 
- **Layer:** Web Route (web-storefront)
- **Implement:** Next.js route for /pricing: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-storefront/src/app/tenants-signup/page.tsx` 
- **Layer:** Web Route (web-storefront)
- **Implement:** Next.js route for /tenants-signup: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-storefront/src/app/trace/[qrToken] (public farm-to-fork scan)/page.tsx` 
- **Layer:** Web Route (web-storefront)
- **Implement:** Next.js route for /trace/[qrToken] (public farm-to-fork scan): server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-storefront/src/components/data-table.tsx` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-storefront/src/features/README.md` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-storefront/src/lib/api-client.ts` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-storefront/src/lib/auth.ts` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-storefront/src/styles/globals.css` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-storefront/tsconfig.json` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** Wave 0/1


---
## `web-tenant`

### `apps/web-tenant/Dockerfile` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-tenant/next.config.js` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/web-tenant/package.json` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-tenant/public/robots.txt` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-tenant/src/app/ai-review-queue/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /ai-review-queue: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/ambassadors/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /ambassadors: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/auctions/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /auctions: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/auditor/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /auditor: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys, Law8 partition pruning
- **Priority:** see build plan

### `apps/web-tenant/src/app/commission-rules/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /commission-rules: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law2 BIGINT money, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/dairy/mcc/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /dairy/mcc: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/dashboard/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /dashboard: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/disputes/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /disputes: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/group-lots/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /group-lots: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/kyc-queue/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /kyc-queue: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/labour/bookings/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /labour/bookings: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/labour/workers/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /labour/workers: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/layout.tsx` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-tenant/src/app/listings/moderation/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /listings/moderation: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/listings/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /listings: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/notifications/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /notifications: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/orders/[id]/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /orders/[id]: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law2 BIGINT money, Law7 i18n keys, Law8 partition pruning
- **Priority:** see build plan

### `apps/web-tenant/src/app/orders/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /orders: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law2 BIGINT money, Law7 i18n keys, Law8 partition pruning
- **Priority:** see build plan

### `apps/web-tenant/src/app/payouts/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /payouts: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law2 BIGINT money, Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/reports/[reportId]/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /reports/[reportId]: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/reports/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /reports: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/schemes/applications/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /schemes/applications: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/settings/billing/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /settings/billing: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/settings/branding/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /settings/branding: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/settings/commissions/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /settings/commissions: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law2 BIGINT money, Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/settings/delivery-zones/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /settings/delivery-zones: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/settings/integrations/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /settings/integrations: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/settings/languages/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /settings/languages: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/settings/staff-permissions/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /settings/staff-permissions: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/settings/team/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /settings/team: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/settings/webhooks/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /settings/webhooks: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/support-inbox/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /support-inbox: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/users/[id]/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /users/[id]: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/users/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /users: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `apps/web-tenant/src/app/wallet/page.tsx` 
- **Layer:** Web Route (web-tenant)
- **Implement:** Next.js route for /wallet: server-render where SEO matters, call typed sdk-js client, render packages/ui components, i18n, role-gated. Tables/exports use server pagination. 
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law7 i18n keys
- **Priority:** Wave 0/1

### `apps/web-tenant/src/components/data-table.tsx` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-tenant/src/features/README.md` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-tenant/src/lib/api-client.ts` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-tenant/src/lib/auth.ts` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-tenant/src/styles/globals.css` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** see build plan

### `apps/web-tenant/tsconfig.json` 
- **Layer:** Web App File
- **Implement:** Next.js app scaffolding (layout/lib/components/styles/config) — tokens from packages/tokens, auth, api client. 
- **Laws:** general
- **Priority:** Wave 0/1
