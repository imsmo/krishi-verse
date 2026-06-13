// shared/constants/limits.ts
// Hard, platform-wide guardrails. BUSINESS limits (per-plan quotas, commission
// %, language counts) live in the DATABASE (plan_limits, tenant_settings) and
// are NOT here — only absolute engineering ceilings belong in code.
export const Limits = {
  PAGE_SIZE_DEFAULT: 20,
  PAGE_SIZE_MAX: 100,
  IDEMPOTENCY_TTL_HOURS: 24,
  LISTING_TITLE_MAX: 250,
  LISTING_DESC_MAX: 5000,
  LISTING_ATTRS_MAX: 50,
  LISTING_MEDIA_MAX: 10,
  UOW_MAX_RETRIES: 3,
  CACHE_LISTING_TTL_SECONDS: 300,
} as const;
