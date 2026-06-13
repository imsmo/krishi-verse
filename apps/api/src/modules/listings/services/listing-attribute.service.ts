// modules/listings/services/listing-attribute.service.ts · manage lot-level dynamic attributes.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { uuidv7 } from '../../../core/database/uuid.util';
import { ListingAttribute, AttrValue } from '../domain/listing-attribute.entity';
import { ListingAttributeRepository } from '../repositories/listing-attribute.repository';

@Injectable()
export class ListingAttributeService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    private readonly repo: ListingAttributeRepository,
  ) {}
  async set(tenantId: string, listingId: string, attributeId: string, value: AttrValue): Promise<void> {
    const a = ListingAttribute.of({ id: uuidv7(), tenantId, listingId, attributeId, value });
    await this.uow.run(tenantId, (tx) => this.repo.upsertMany(tx, [a]));
  }
}
