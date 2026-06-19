// modules/livestock/repositories/animal-breed.repository.ts · READ-ONLY animal_breeds (global master data).
import { Inject, Injectable } from '@nestjs/common';
import { READ_REPLICA, ReadReplicaProvider } from '../../../core/database/read-replica.provider';
import { TxContext } from '../../../core/database/unit-of-work';
import { AnimalBreed } from '../domain/animal-breed.entity';
const toDomain = (r: any) => AnimalBreed.rehydrate({ id: r.id, speciesId: r.species_id, code: r.code, defaultName: r.default_name, isIndigenous: r.is_indigenous, originRegionId: r.origin_region_id });

@Injectable()
export class AnimalBreedRepository {
  constructor(@Inject(READ_REPLICA) private readonly replica: ReadReplicaProvider) {}
  async listBySpecies(tenantId: string, speciesId: string): Promise<AnimalBreed[]> {
    const r = await this.replica.forTenant(tenantId).query(`SELECT id, species_id, code, default_name, is_indigenous, origin_region_id FROM animal_breeds WHERE species_id=$1 ORDER BY default_name`, [speciesId]);
    return r.rows.map(toDomain);
  }
  /** Validate the breed exists AND belongs to the species (inside a write tx). */
  async belongsToSpecies(tx: TxContext, breedId: string, speciesId: string): Promise<boolean> {
    const r = await tx.query(`SELECT 1 FROM animal_breeds WHERE id=$1 AND species_id=$2`, [breedId, speciesId]);
    return r.rows.length > 0;
  }
}
