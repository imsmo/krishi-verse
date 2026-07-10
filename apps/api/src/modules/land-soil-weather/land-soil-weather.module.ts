// modules/land-soil-weather/land-soil-weather.module.ts
// Land, Soil & Weather (PRD M24): the farm-data backbone. Farmers register their land parcels (survey/khasra
// + bhulekh linkage, area, irrigation, boundary), track crop seasons (plan→sow→harvest), and record Soil
// Health Card results; everyone can browse regional weather advisories. This is an agronomy DATA + ADVISORY
// module — there is NO in-platform money path. Gated by the `land_soil_weather` feature flag (default OFF).
//
// SCOPE (this build): land parcels (farm registry) + crop seasons (lifecycle) + soil tests + read-only
// regional weather-alert browse.
// DEFERRED (schema in 0010 / platform surface): weather-alert INGESTION (IMD/Skymet pipeline, Law 11),
// advisory push + bhulekh-verify jobs, parcel verification_status workflow (KYC/admin), PostGIS boundary
// geometry/area auto-calc, soil-test recommendation engine. (land_parcels.id is already the FK target for
// contract_growers.land_parcel_id — cross-module reference only, no import.)
import { Module } from '@nestjs/common';
import { ParcelsController } from './controllers/v1/parcels.controller';
import { CropSeasonsController } from './controllers/v1/crop-seasons.controller';
import { SoilTestsController } from './controllers/v1/soil-tests.controller';
import { LandParcelService } from './services/land-parcel.service';
import { CropSeasonService } from './services/crop-season.service';
import { SoilTestService } from './services/soil-test.service';
import { WeatherAlertService } from './services/weather-alert.service';
import { ForecastService } from './services/forecast.service';
import { WeatherPrefsService } from './services/weather-prefs.service';
import { weatherForecastProvider } from './gateway/weather-forecast.provider';
import { reverseGeocodeProvider } from './gateway/reverse-geocode.provider';
import { WeatherAdvisoryPushJob } from './jobs/weather-advisory-push.job';
import { LandParcelRepository } from './repositories/land-parcel.repository';
import { CropSeasonRepository } from './repositories/crop-season.repository';
import { SoilTestRepository } from './repositories/soil-test.repository';
import { WeatherAlertRepository } from './repositories/weather-alert.repository';
import { WeatherPrefsRepository } from './repositories/weather-prefs.repository';

@Module({
  controllers: [ParcelsController, CropSeasonsController, SoilTestsController],
  providers: [
    LandParcelService, CropSeasonService, SoilTestService, WeatherAlertService, ForecastService, WeatherPrefsService,
    weatherForecastProvider, reverseGeocodeProvider, WeatherAdvisoryPushJob,
    LandParcelRepository, CropSeasonRepository, SoilTestRepository, WeatherAlertRepository, WeatherPrefsRepository,
  ],
  exports: [LandParcelService, CropSeasonService, SoilTestService, WeatherAlertService, ForecastService, WeatherPrefsService, WeatherAdvisoryPushJob],
})
export class LandSoilWeatherModule {}
