// modules/land-soil-weather/services/weather-prefs.service.ts · get/save the caller's weather advisory prefs (P1-4).
// One ACID tx per write (UoW). Defaults are applied when the farmer has never saved prefs (so the screen always
// renders real, deterministic toggle states — never a fabricated or empty value).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { WeatherPrefsRepository, WeatherPrefs } from '../repositories/weather-prefs.repository';

export const DEFAULT_WEATHER_PREFS: WeatherPrefs = { morningAdvisory: true, weeklyOutlook: true, severeOnly: false };

@Injectable()
export class WeatherPrefsService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly repo: WeatherPrefsRepository,
  ) {}

  async get(tenantId: string, userId: string): Promise<WeatherPrefs> {
    return (await this.repo.get(tenantId, userId)) ?? { ...DEFAULT_WEATHER_PREFS };
  }

  async save(tenantId: string, userId: string, p: WeatherPrefs): Promise<WeatherPrefs> {
    await this.uow.run(tenantId, async (tx) => { await this.repo.upsert(tx, tenantId, userId, p); }, { userId });
    return p;
  }
}
