// modules/identity/services/address.service.ts · user address book (owner-scoped).
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { uuidv7 } from '../../../core/database/uuid.util';
import { Address } from '../domain/address.entity';
import { AddressRepository } from '../repositories/address.repository';
import { CreateAddressDto, UpdateAddressDto } from '../dto/create-address.dto';
import { DomainError } from '../../../shared/errors/app-error';

@Injectable()
export class AddressService {
  constructor(@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork, private readonly repo: AddressRepository) {}

  async create(tenantId: string, userId: string, dto: CreateAddressDto) {
    const id = await this.uow.run(tenantId, async (tx) => {
      if (dto.isDefault) await this.repo.unsetDefaults(tx, userId);
      const a = Address.create({ id: uuidv7(), userId, tenantId: null, labelId: dto.labelId ?? null, line1: dto.line1, line2: dto.line2 ?? null, village: dto.village ?? null, regionId: dto.regionId ?? null, pincode: dto.pincode ?? null, countryCode: dto.countryCode, lat: dto.lat ?? null, lng: dto.lng ?? null, contactName: dto.contactName ?? null, contactPhone: dto.contactPhone ?? null, isDefault: dto.isDefault });
      await this.repo.insert(tx, a);
      return a.id;
    }, { userId });
    return { id };
  }
  async update(tenantId: string, userId: string, id: string, dto: UpdateAddressDto) {
    await this.uow.run(tenantId, async (tx) => {
      const a = await this.repo.getForUpdate(tx, id, userId);
      if (!a) throw new DomainError('ADDRESS_NOT_FOUND', 'Address not found', 404);
      if (dto.isDefault) await this.repo.unsetDefaults(tx, userId);
      a.update(dto);
      if (dto.isDefault) a.makeDefault();
      await this.repo.update(tx, a);
    }, { userId });
    return { ok: true };
  }
  list(tenantId: string, userId: string) { return this.repo.listByUser(tenantId, userId).then((rows) => rows.map((a) => a.toProps())); }
  async remove(tenantId: string, userId: string, id: string) {
    await this.uow.run(tenantId, (tx) => this.repo.softDelete(tx, id, userId), { userId });
    return { ok: true };
  }
}
