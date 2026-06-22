// modules/logistics/domain/cold-chain-log.entity.ts · an immutable reefer/vaccine temperature reading
// (0007 cold_chain_logs, PRD §24.9/§18.12). APPEND-ONLY telemetry (DB REVOKEs UPDATE/DELETE; partitioned by
// recorded_at, bigserial id assigned by the DB). Pure TS. `is_breach` is computed at record time from the
// subject's allowed band — once written it never changes. Temperatures are physical measurements (decimal), not
// money. Tenant-scoped (tenant_id may be NULL for platform-level devices). The breach-alert job reads these.
import { InvalidColdChainReadingError } from './logistics.errors';

export const COLD_CHAIN_SUBJECTS = ['shipment', 'bmc_unit', 'warehouse_chamber', 'vaccine_box'] as const;
export type ColdChainSubject = (typeof COLD_CHAIN_SUBJECTS)[number];

const TEMP_MIN = -60;   // sane sensor envelope (°C) — reject obviously bogus readings
const TEMP_MAX = 80;
const HUM_MIN = 0;
const HUM_MAX = 100;

export interface ColdChainReadingInput {
  tenantId: string | null; subjectType: ColdChainSubject | string; subjectId: string;
  tempC: number; humidityPct?: number | null; deviceRef?: string | null; recordedAt: Date;
  allowedMinC: number; allowedMaxC: number;     // the subject's acceptable band → drives is_breach
}

export interface ColdChainLogProps {
  id: string | null; tenantId: string | null; subjectType: string; subjectId: string;
  tempC: number; humidityPct: number | null; deviceRef: string | null; recordedAt: Date; isBreach: boolean;
}

function num(v: number, lo: number, hi: number, label: string): number {
  if (typeof v !== 'number' || Number.isNaN(v) || !Number.isFinite(v)) throw new InvalidColdChainReadingError(`${label} must be a finite number`);
  if (v < lo || v > hi) throw new InvalidColdChainReadingError(`${label} out of range [${lo},${hi}]`);
  return v;
}

export class ColdChainLog {
  private constructor(private p: ColdChainLogProps) {}

  /** Record a reading; computes is_breach from the subject's allowed band. No id yet (DB bigserial assigns it). */
  static record(input: ColdChainReadingInput): ColdChainLog {
    if (!(COLD_CHAIN_SUBJECTS as readonly string[]).includes(input.subjectType)) throw new InvalidColdChainReadingError(`subject_type must be one of ${COLD_CHAIN_SUBJECTS.join('|')}`);
    const tempC = num(input.tempC, TEMP_MIN, TEMP_MAX, 'temp_c');
    const humidityPct = input.humidityPct == null ? null : num(input.humidityPct, HUM_MIN, HUM_MAX, 'humidity_pct');
    const min = num(input.allowedMinC, TEMP_MIN, TEMP_MAX, 'allowedMinC');
    const max = num(input.allowedMaxC, TEMP_MIN, TEMP_MAX, 'allowedMaxC');
    if (min > max) throw new InvalidColdChainReadingError('allowedMinC must be <= allowedMaxC');
    if (!(input.recordedAt instanceof Date) || Number.isNaN(input.recordedAt.getTime())) throw new InvalidColdChainReadingError('recorded_at must be a valid timestamp');
    const isBreach = tempC < min || tempC > max;
    return new ColdChainLog({
      id: null, tenantId: input.tenantId, subjectType: input.subjectType, subjectId: input.subjectId,
      tempC, humidityPct, deviceRef: input.deviceRef ?? null, recordedAt: input.recordedAt, isBreach,
    });
  }
  static rehydrate(p: ColdChainLogProps): ColdChainLog { return new ColdChainLog(p); }

  get isBreach() { return this.p.isBreach; }
  toProps(): Readonly<ColdChainLogProps> { return Object.freeze({ ...this.p }); }
}
