// modules/tenancy/domain/tenancy.events.ts · integration events (via outbox, Law 4).
export const TenancyEventType = {
  PlanCreated:        'tenancy.plan_created',
  PlanUpdated:        'tenancy.plan_updated',
  Subscribed:         'tenancy.subscribed',
  PlanChanged:        'tenancy.subscription_plan_changed',
  SubscriptionCancelled: 'tenancy.subscription_cancelled',
  SubscriptionExpired:   'tenancy.subscription_expired',
  // self-serve (profile / onboarding / domains / settings)
  TenantProfileUpdated:    'tenancy.tenant_profile_updated',
  TenantOnboardingSubmitted: 'tenancy.tenant_onboarding_submitted',
  TenantDomainAdded:       'tenancy.tenant_domain_added',
  TenantDomainPrimaryChanged: 'tenancy.tenant_domain_primary_changed',
  TenantDomainRemoved:     'tenancy.tenant_domain_removed',
  TenantSettingChanged:    'tenancy.tenant_setting_changed',
} as const;
export type DomainEvent = { type: string; payload: Record<string, unknown> };

export const BILLING_CYCLES = ['monthly', 'annual'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];
