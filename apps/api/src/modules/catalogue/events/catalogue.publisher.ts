// modules/catalogue/events/catalogue.publisher.ts · catalogue does NOT use a separate publisher: integration
// events are written to the outbox in the SAME db transaction as the state change (Law 4), inside each service's
// private `flush()` (see ProductService/ProductBatchService/CertificateService). This module re-exports the event
// catalogue as the stable import surface for downstream consumers (e.g. communication reacting to
// catalogue.certificate_expired / catalogue.batch_expiring). Mirrors offers.publisher.
export { CatalogueEventType } from '../domain/catalogue.events';
