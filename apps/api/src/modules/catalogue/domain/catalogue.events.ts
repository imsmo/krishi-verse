// modules/catalogue/domain/catalogue.events.ts · integration events (via outbox).
export const CatalogueEventType = {
  ProductCreated: 'catalogue.product_created',
  ProductUpdated: 'catalogue.product_updated',
  ProductDeactivated: 'catalogue.product_deactivated',
  TenantCategoryToggled: 'catalogue.tenant_category_toggled',
  BatchCreated: 'catalogue.batch_created',
  BatchRecalled: 'catalogue.batch_recalled',
  BatchExpiring: 'catalogue.batch_expiring',
  CertificateSubmitted: 'catalogue.certificate_submitted',
  CertificateVerified: 'catalogue.certificate_verified',
  CertificateRejected: 'catalogue.certificate_rejected',
  CertificateExpired: 'catalogue.certificate_expired',
} as const;
export type CatalogueEventType = typeof CatalogueEventType[keyof typeof CatalogueEventType];
export type DomainEvent = { type: string; payload: Record<string, unknown> };
