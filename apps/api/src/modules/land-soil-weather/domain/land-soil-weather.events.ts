// modules/land-soil-weather/domain/land-soil-weather.events.ts · integration events (via outbox, Law 4).
export const LandEventType = {
  ParcelRegistered: 'land.parcel_registered',
  ParcelUpdated:    'land.parcel_updated',
  CropSeasonPlanned:'land.crop_season_planned',
  CropSeasonSown:   'land.crop_season_sown',
  CropSeasonHarvested:'land.crop_season_harvested',
  CropSeasonAbandoned:'land.crop_season_abandoned',
  SoilTestRecorded: 'land.soil_test_recorded',
} as const;
export type DomainEvent = { type: string; payload: Record<string, unknown> };

export const CROP_SEASONS = ['kharif', 'rabi', 'zaid', 'perennial'] as const;
export type CropSeasonName = (typeof CROP_SEASONS)[number];
export const ALERT_SEVERITIES = ['info', 'watch', 'warning', 'severe'] as const;
