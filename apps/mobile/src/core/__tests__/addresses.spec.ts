// Unit tests for the PURE address-book logic (screen 134).
import { sortAddresses, hasMapPin } from '../../features/addresses/addresses';

describe('address book (screen 134)', () => {
  it('sortAddresses puts the primary first, preserving order otherwise', () => {
    const list = [{ id: 'a', isDefault: false }, { id: 'b', isDefault: true }, { id: 'c', isDefault: false }];
    expect(sortAddresses(list).map((x) => x.id)).toEqual(['b', 'a', 'c']);
    expect(sortAddresses([{ id: 'x', isDefault: false }]).map((x) => x.id)).toEqual(['x']);
  });
  it('hasMapPin only when both lat and lng are real numbers', () => {
    expect(hasMapPin({ lat: 22.3, lng: 73.1 })).toBe(true);
    expect(hasMapPin({ lat: null, lng: 73.1 })).toBe(false);
    expect(hasMapPin({ lat: undefined, lng: undefined })).toBe(false);
  });
});
