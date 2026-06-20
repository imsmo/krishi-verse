// modules/market-intel/domain/market-intel.events.ts · integration events (via outbox) + vocab.
export const MarketEventType = {
  PriceIngested:       'market.price_ingested',
  PredictionGenerated: 'market.prediction_generated',
  PriceAlertTriggered: 'market.price_alert_triggered',   // → notification fanout
  PriceAlertCreated:   'market.price_alert_created',
} as const;
export type MarketEventType = (typeof MarketEventType)[keyof typeof MarketEventType];
export type DomainEvent = { type: string; payload: Record<string, unknown> };

export const PRICE_SOURCES = ['agmarknet', 'enam', 'platform_txn', 'ambassador_manual'] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];
export const ALERT_DIRECTIONS = ['above', 'below'] as const;
export type AlertDirection = (typeof ALERT_DIRECTIONS)[number];
