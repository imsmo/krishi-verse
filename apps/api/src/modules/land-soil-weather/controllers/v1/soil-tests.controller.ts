// modules/land-soil-weather/controllers/v1/soil-tests.controller.ts · soil tests + weather advisory browse. `land_soil_weather` flag.
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../../../core/auth/permissions.guard';
import { FeatureFlag, FeatureFlagGuard } from '../../../../core/feature-flags/flags.guard';
import { ZodBody, ZodQuery } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { SoilTestService } from '../../services/soil-test.service';
import { WeatherAlertService } from '../../services/weather-alert.service';
import { ForecastService } from '../../services/forecast.service';
import { RecordSoilTestSchema, RecordSoilTestDto } from '../../dto/create-soil-test.dto';
import { QuerySoilTestsSchema, QuerySoilTestsDto } from '../../dto/query-soil-test.dto';
import { QueryWeatherSchema, QueryWeatherDto } from '../../dto/query-weather-alert.dto';
import { QueryForecastSchema, QueryForecastDto } from '../../dto/query-forecast.dto';
import { LandPermissions, canManageLand, isLandAdmin } from '../../policies/land-soil-weather.policies';

@Controller({ path: 'land', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard, FeatureFlagGuard)
@FeatureFlag('land_soil_weather')
export class SoilTestsController {
  constructor(private readonly soil: SoilTestService, private readonly weather: WeatherAlertService, private readonly forecast: ForecastService) {}
  private actor(ctx: RequestContext) { return { userId: ctx.userId, canManage: canManageLand(ctx), isAdmin: isLandAdmin(ctx) }; }

  @Post('soil-tests') @RequirePermissions(LandPermissions.Manage)
  record(@CurrentContext() ctx: RequestContext, @ZodBody(RecordSoilTestSchema) dto: RecordSoilTestDto) { return this.soil.record(ctx.tenantId, this.actor(ctx), dto).then((data) => ({ data })); }
  @Get('soil-tests')
  list(@CurrentContext() ctx: RequestContext, @ZodQuery(QuerySoilTestsSchema) q: QuerySoilTestsDto) { return this.soil.list(ctx.tenantId, this.actor(ctx), q.parcelId).then((data) => ({ data })); }

  // regional weather advisories (read-only, ingested reference data)
  @Get('weather-alerts')
  weather_(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryWeatherSchema) q: QueryWeatherDto) { return this.weather.listForRegion(ctx.tenantId, q.regionId, q.activeOnly, q.limit).then((data) => ({ data })); }

  // geocoded forecast (P0-12): a real provider forecast for lat/lng, cached + resilience-wrapped. If the provider
  // is down and a regionId was given, it DEGRADES to that region's real advisories (degraded:true) — never faked.
  @Get('weather-forecast')
  forecast_(@CurrentContext() ctx: RequestContext, @ZodQuery(QueryForecastSchema) q: QueryForecastDto) {
    return this.forecast.forecast(ctx.tenantId, q).then((data) => ({ data }));
  }
}
