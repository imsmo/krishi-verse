// modules/labour/services/minimum-wage.service.ts · resolves the statutory DIGNITY FLOOR (read-only).
// Used by booking creation to snapshot min_wage at posting. Fails CLOSED: if no row is configured for the
// region/skill level, the booking is rejected (we never silently allow a sub-floor wage). Admin CRUD of
// minimum_wages + the periodic gazette-sync job are deferred (the rows are seeded by db/seeds/rules).
import { Injectable } from '@nestjs/common';
import { TxContext } from '../../../core/database/unit-of-work';
import { MinimumWageRepository } from '../repositories/minimum-wage.repository';
import { SkillLevel, WageKind } from '../domain/labour.events';
import { NoMinimumWageFloorError } from '../domain/labour.errors';

@Injectable()
export class MinimumWageService {
  constructor(private readonly repo: MinimumWageRepository) {}

  /** The statutory floor (minor units) for (region, skill level, wage kind) on `onDate`. Throws if none. */
  async resolveFloor(tenantId: string, regionId: string, skillLevel: SkillLevel, wageKind: WageKind, onDate: string, tx?: TxContext): Promise<bigint> {
    const mw = await this.repo.resolve(tenantId, regionId, skillLevel, onDate, tx);
    if (!mw) throw new NoMinimumWageFloorError(regionId, skillLevel);
    return mw.floorFor(wageKind);
  }
}
