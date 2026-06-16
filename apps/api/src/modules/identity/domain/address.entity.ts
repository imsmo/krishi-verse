// modules/identity/domain/address.entity.ts · user/tenant address book entry.
import { DomainError } from '../../../shared/errors/app-error';
export interface AddressProps {
  id: string; userId: string | null; tenantId: string | null; labelId: string | null;
  line1: string; line2: string | null; village: string | null; regionId: string | null;
  pincode: string | null; countryCode: string; lat: number | null; lng: number | null;
  contactName: string | null; contactPhone: string | null; isDefault: boolean;
}
export class Address {
  private constructor(private props: AddressProps) {}
  static create(input: Omit<AddressProps, 'isDefault'> & { isDefault?: boolean }): Address {
    if (!input.line1 || input.line1.trim().length < 3) throw new DomainError('ADDRESS_INVALID', 'line1 is required', 422);
    if (input.pincode && !/^\d{4,10}$/.test(input.pincode)) throw new DomainError('ADDRESS_INVALID', 'invalid pincode', 422);
    return new Address({ ...input, isDefault: input.isDefault ?? false });
  }
  static rehydrate(p: AddressProps): Address { return new Address(p); }
  get id() { return this.props.id; }
  toProps(): Readonly<AddressProps> { return Object.freeze({ ...this.props }); }
  update(patch: Partial<Pick<AddressProps,'line1'|'line2'|'village'|'regionId'|'pincode'|'lat'|'lng'|'contactName'|'contactPhone'|'labelId'>>): void {
    Object.assign(this.props, patch);
  }
  makeDefault(): void { this.props.isDefault = true; }
}
