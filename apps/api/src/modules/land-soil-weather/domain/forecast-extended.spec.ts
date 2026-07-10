// Unit tests for the PURE P1-4 forecast normalisers (extended daily metrics + hourly). No I/O; provider→domain map.
import { normaliseOpenMeteoDaily, normaliseOpenMeteoHourly } from './forecast';

describe('normaliseOpenMeteoDaily (extended metrics)', () => {
  it('attaches apparent temp / uv / wind bearing / sunrise-set when present', () => {
    const [d] = normaliseOpenMeteoDaily({
      time: ['2026-07-06'], temperature_2m_min: [24], temperature_2m_max: [34],
      precipitation_sum: [2], precipitation_probability_max: [60], wind_speed_10m_max: [12], weather_code: [61],
      apparent_temperature_min: [26], apparent_temperature_max: [38], uv_index_max: [9.4],
      wind_direction_10m_dominant: [270], sunrise: ['2026-07-06T05:55'], sunset: ['2026-07-06T19:10'],
    });
    expect(d.feelsLikeMaxC).toBe(38);
    expect(d.uvIndexMax).toBe(9.4);
    expect(d.windDirDeg).toBe(270);
    expect(d.sunrise).toBe('2026-07-06T05:55');
    expect(d.code).toBe('rain');
  });
  it('leaves extended metrics null when the provider omits them (never fabricated 0)', () => {
    const [d] = normaliseOpenMeteoDaily({ time: ['2026-07-06'], temperature_2m_min: [24], temperature_2m_max: [34], weather_code: [0] });
    expect(d.feelsLikeMaxC).toBeNull();
    expect(d.uvIndexMax).toBeNull();
    expect(d.sunrise).toBeNull();
    expect(d.code).toBe('clear');
  });
});

describe('normaliseOpenMeteoHourly', () => {
  const base = Date.parse('2026-07-06T09:00');
  const hourly = {
    time: ['2026-07-06T08:00', '2026-07-06T09:00', '2026-07-06T10:00'],
    temperature_2m: [29, 31, 33], apparent_temperature: [31, 34, 36], relative_humidity_2m: [70, 62, 55],
    precipitation_probability: [10, 20, 40], weather_code: [1, 2, 61], surface_pressure: [1004, 1003, 1002],
    wind_speed_10m: [8, 10, 12], uv_index: [3, 5, 7],
  };
  it('keeps the current + future hours (drops stale past), maps real metrics', () => {
    const h = normaliseOpenMeteoHourly(hourly, base);
    expect(h).toHaveLength(2);              // 08:00 dropped (>1h before now); 09:00 + 10:00 kept
    expect(h[0].time).toBe('2026-07-06T09:00');
    expect(h[0].humidityPct).toBe(62);
    expect(h[0].pressureHpa).toBe(1003);
    expect(h[1].code).toBe('rain');
  });
  it('caps to max and returns [] on empty', () => {
    expect(normaliseOpenMeteoHourly(hourly, base, 1)).toHaveLength(1);
    expect(normaliseOpenMeteoHourly({}, base)).toEqual([]);
  });
});
