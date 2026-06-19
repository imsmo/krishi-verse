// modules/livestock/repositories/animal-species.repository.ts · READ-ONLY animal_species (global master data).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { AnimalSpecies } from '../domain/animal-species.entity';
const toDomain = (r: any) => AnimalSpecies.rehydrate({ id: r.id, code: r.code, defaultName: r.default_name, isActive: r.is_active });

@Injectable()
export class AnimalSpeciesRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async list(tenantId: string, activeOnly: boolean): Promise<AnimalSpecies[]> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT id, code, default_name, is_active FROM animal_species ${activeOnly ? 'WHERE is_active=true' : ''} ORDER BY default_name`, []);
    return r.rows.map(toDomain);
  }
  /** Existence check inside a write tx (typed 404 instead of a raw FK violation). */
  async exists(tx: TxContext, id: string): Promise<boolean> {
    const r = await tx.query(`SELECT 1 FROM animal_species WHERE id=$1 AND is_active=true`, [id]);
    return r.rows.length > 0;
  }
}
