// modules/labour/domain/minimum-wage.entity.ts · read-only value object for a statutory minimum-wage row.
// minimum_wages is GLOBAL master data (region × skill_level, effective-dated) seeded by db/seeds/rules.
// Labour only READS it to snapshot the dignity floor at booking time; it never writes it (admin CRUD deferred).
import { SkillLevel, WageKind } from './labour.events';

export interface MinimumWageProps {
  id: string;
  regionId: string;
  skillLevel: SkillLevel;
  dailyWageMinor: bigint;
  hourlyWageMinor: bigint | null;
  overtimeMultiplier: number;
  effectiveFrom: Date;
}

export class MinimumWage {
  private constructor(private readonly props: MinimumWageProps) {}
  static rehydrate(props: MinimumWageProps): MinimumWage { return new MinimumWage(props); }
  toProps(): Readonly<MinimumWageProps> { return Object.freeze({ ...this.props }); }
  get dailyWageMinor() { return this.props.dailyWageMinor; }
  get hourlyWageMinor() { return this.props.hourlyWageMinor; }

  /** The statutory floor for a given wage kind. per_task has no statutory hourly/daily floor, so the
   *  daily wage is used as the conservative floor (an offered task price must clear at least one day). */
  floorFor(kind: WageKind): bigint {
    if (kind === 'per_hour') return this.props.hourlyWageMinor ?? this.props.dailyWageMinor;
    return this.props.dailyWageMinor;
  }
}
