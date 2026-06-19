// modules/land-soil-weather/services/weather-alert.service.ts · read-only regional weather-advisory browse.
// Global ingested data (Law 11 — authored by the IMD/Skymet pipeline on the platform surface); farmers read it.
import { Injectable } from '@nestjs/common';
import { WeatherAlertRepository } from '../repositories/weather-alert.repository';

@Injectable()
export class WeatherAlertService {
  constructor(private readonly repo: WeatherAlertRepository) {}
  async listForRegion(tenantId: string, regionId: string, activeOnly: boolean, limit: number) {
    return (await this.repo.listForRegion(tenantId, regionId, activeOnly, limit)).map((a) => a.toJSON());
  }
}
