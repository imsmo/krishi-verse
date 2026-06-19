// modules/livestock/services/animal-species.service.ts · read-only taxonomy (species + breeds browse).
// Global master data (seeded); no writes here (admin CRUD deferred). Reads on the replica.
import { Injectable } from '@nestjs/common';
import { AnimalSpeciesRepository } from '../repositories/animal-species.repository';
import { AnimalBreedRepository } from '../repositories/animal-breed.repository';

@Injectable()
export class AnimalSpeciesService {
  constructor(private readonly species: AnimalSpeciesRepository, private readonly breeds: AnimalBreedRepository) {}
  async listSpecies(tenantId: string, activeOnly: boolean) { return (await this.species.list(tenantId, activeOnly)).map((s) => s.toJSON()); }
  async listBreeds(tenantId: string, speciesId: string) { return (await this.breeds.listBySpecies(tenantId, speciesId)).map((b) => b.toJSON()); }
}
