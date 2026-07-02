// Unit tests for the PURE fair-price band (screen 11). bigint-minor paise; no floats.
import { fairBand } from '../../features/listings/fair-price';

describe('fairBand', () => {
  it('marks in-range when low ≤ you ≤ high', () => {
    const b = fairBand('288000', '265000', '310000')!;
    expect(b.status).toBe('inRange');
    expect(b.lowMinor).toBe('265000');
    expect(b.highMinor).toBe('310000');
    expect(b.youMinor).toBe('288000');
    expect(b.position).toBeCloseTo((288000 - 265000) / (310000 - 265000));
  });
  it('marks below / above the band', () => {
    expect(fairBand('250000', '265000', '310000')!.status).toBe('below');
    expect(fairBand('320000', '265000', '310000')!.status).toBe('above');
  });
  it('clamps position to [0,1]', () => {
    expect(fairBand('100000', '265000', '310000')!.position).toBe(0);
    expect(fairBand('999000', '265000', '310000')!.position).toBe(1);
  });
  it('returns null when band data is missing or degenerate (→ screen hides the card, never fakes)', () => {
    expect(fairBand('288000', null, '310000')).toBeNull();
    expect(fairBand('288000', '310000', '265000')).toBeNull(); // low > high
    expect(fairBand('', '265000', '310000')).toBeNull();
    expect(fairBand('288000', 'abc', '310000')).toBeNull();
  });
});
