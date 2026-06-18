// modules/requirements/events/handlers/listing-published.handler.ts
// DEFERRED (explicitly flagged, not faked): when a listing is published, notify buyers whose OPEN
// requirements match it (category/product/region). This needs the communication/notifications module
// (not yet built) to deliver the nudge, so it is intentionally NOT registered yet. Tracked for the
// engagement wave. No silent stub — the matching read + fan-out lands with notifications.
export {};
