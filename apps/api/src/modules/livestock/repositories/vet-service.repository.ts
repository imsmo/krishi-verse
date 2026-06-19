// modules/livestock/repositories/vet-service.repository.ts · all SQL for vet_services. A vet's priced
// catalog; UNIQUE(vet_id, service_type_id). Resolves the vet_service lookup code → platform id (anti-IDOR).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { VetService } from '../domain/vet-service.entity';
import { VetPricingUnit } from '../domain/livestock.events';
import { InvalidVetServiceTypeError } from '../domain/livestock.errors';

const COLS = `id, vet_id, service_type_id, price_minor, pricing_unit, is_emergency_available, created_at`;
function toDomain(r: any): VetService {
  return VetService.rehydrate({ id: r.id, vetId: r.vet_id, serviceTypeId: r.service_type_id, priceMinor: BigInt(r.price_minor),
    pricingUnit: r.pricing_unit as VetPricingUnit, isEmergencyAvailable: r.is_emergency_available, createdAt: r.created_at });
}

@Injectable()
export class VetServiceRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}

  /** Resolve vet_service lookup CODE → platform lookup_values id (never trust a client-supplied id). */
  async resolveServiceTypeId(tx: TxContext, code: string): Promise<string> {
    const r = await tx.query(`SELECT id FROM lookup_values WHERE type_code='vet_service' AND code=$1 AND tenant_id IS NULL AND is_active=true`, [code]);
    if (!r.rows[0]) throw new InvalidVetServiceTypeError(code);
    return r.rows[0].id;
  }
  /** Idempotent upsert (one price per vet+service type). */
  async upsert(tx: TxContext, s: VetService): Promise<void> {
    const p = s.toProps();
    await tx.query(
      `INSERT INTO vet_services (id, vet_id, service_type_id, price_minor, pricing_unit, is_emergency_available, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,(SELECT user_id FROM vet_profiles WHERE id=$2))
       ON CONFLICT (vet_id, service_type_id) DO UPDATE SET price_minor=EXCLUDED.price_minor, pricing_unit=EXCLUDED.pricing_unit,
         is_emergency_available=EXCLUDED.is_emergency_available, updated_at=now()`,
      [p.id, p.vetId, p.serviceTypeId, p.priceMinor.toString(), p.pricingUnit, p.isEmergencyAvailable]);
  }
  async getForBooking(tx: TxContext, id: string): Promise<VetService | null> {
    const r = await tx.query(`SELECT ${COLS} FROM vet_services WHERE id=$1 AND deleted_at IS NULL`, [id]);
    return r.rows[0] ? toDomain(r.rows[0]) : null;
  }
  async listByVet(tenantId: string, vetId: string): Promise<VetService[]> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT ${COLS} FROM vet_services WHERE vet_id=$1 AND deleted_at IS NULL ORDER BY created_at`, [vetId]);
    return r.rows.map(toDomain);
  }
}
