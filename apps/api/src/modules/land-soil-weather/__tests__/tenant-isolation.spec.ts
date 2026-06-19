// modules/land-soil-weather/__tests__/tenant-isolation.spec.ts · tenant-scoping SQL contract (CI gate).
// Every parcel/crop-season/soil-test read+write binds tenant_id (Law 1). No version columns → mutations lock
// FOR UPDATE. Lists are keyset (never OFFSET). The irrigation lookup resolves platform-scoped (tenant_id IS
// NULL). weather_alerts is GLOBAL (region-scoped), partition-pruned by created_at.
import { LandParcelRepository } from '../repositories/land-parcel.repository';
import { CropSeasonRepository } from '../repositories/crop-season.repository';
import { SoilTestRepository } from '../repositories/soil-test.repository';
import { WeatherAlertRepository } from '../repositories/weather-alert.repository';
import { LandParcel } from '../domain/land-parcel.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }

describe('land_parcels isolation', () => {
  it('getForUpdate binds tenant_id + FOR UPDATE', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new LandParcelRepository(fakeReplica().provider).getForUpdate(tx as any, 'tA', 'p1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/); expect(params).toEqual(['p1', 'tA']);
  });
  it('resolveIrrigationTypeId is platform-scoped (tenant_id IS NULL)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'i1' }], rowCount: 1 }) };
    await new LandParcelRepository(fakeReplica().provider).resolveIrrigationTypeId(tx as any, 'drip');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/type_code='irrigation'/); expect(sql).toMatch(/tenant_id IS NULL/); expect(params).toEqual(['drip']);
  });
  it('insert binds tenant_id; listFor keyset (no OFFSET)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const p = LandParcel.register({ id: 'p1', tenantId: 'tA', ownerUserId: 'u1', regionId: null, surveyNo: null, bhulekhRef: null, areaTenThousandth: 10000n, areaUnit: 'acre', irrigationTypeId: null, boundaryGeojson: null, isTenantFarmed: false });
    await new LandParcelRepository(fakeReplica().provider).insert(tx as any, p);
    expect(tx.query.mock.calls[0][0]).toMatch(/INSERT INTO land_parcels/); expect(tx.query.mock.calls[0][1]).toContain('tA');
    const { provider, exec } = fakeReplica();
    await new LandParcelRepository(provider).listFor('tA', { limit: 50 });
    expect(exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
  });
});

describe('crop_seasons + soil_tests isolation', () => {
  it('crop getForUpdate binds tenant_id + FOR UPDATE; listForParcel tenant+parcel', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new CropSeasonRepository(fakeReplica().provider).getForUpdate(tx as any, 'tA', 'c1');
    expect(tx.query.mock.calls[0][0]).toMatch(/id=\$1 AND tenant_id=\$2/); expect(tx.query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
    const { provider, exec } = fakeReplica();
    await new CropSeasonRepository(provider).listForParcel('tA', 'p1');
    expect(exec.query.mock.calls[0][1]).toEqual(['tA', 'p1']); expect(exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
  });
  it('soil listForParcel binds tenant_id + parcel', async () => {
    const { provider, exec } = fakeReplica();
    await new SoilTestRepository(provider).listForParcel('tA', 'p1');
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND parcel_id=\$2/); expect(params).toEqual(['tA', 'p1']);
  });
});

describe('weather_alerts (global region advisories)', () => {
  it('listForRegion filters region + bounds created_at (partition prune) + active validity', async () => {
    const { provider, exec } = fakeReplica();
    await new WeatherAlertRepository(provider).listForRegion('tA', 'reg1', true, 50);
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/region_id=\$1/); expect(sql).toMatch(/created_at >= now\(\) - interval '30 days'/);
    expect(sql).toMatch(/valid_from <= now\(\) AND valid_to >= now\(\)/); expect(params).toEqual(['reg1', 50]);
  });
});
