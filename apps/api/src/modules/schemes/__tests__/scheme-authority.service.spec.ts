// modules/schemes/__tests__/scheme-authority.service.spec.ts · SchemeService unit tests (fakes).
// Pins the read-only browse + the eligibility-check delegation + typed 404 for a missing scheme.
import { SchemeService } from '../services/scheme.service';
import { Scheme } from '../domain/scheme.entity';
import { SchemeNotFoundError } from '../domain/schemes.errors';

const scheme = Scheme.rehydrate({ id: 's1', code: 'pm_kisan', defaultName: 'PM-KISAN', authorityId: 'au1', categoryId: 'c1', benefitSummary: {}, eligibilityRules: { roles: ['farmer'] }, requiredDocTypeIds: [], applicationWindow: null, applicableRegionIds: [], processingFeeMinor: 0n, version: 2, isActive: true });

function harness(found: Scheme | null) {
  const schemes = { list: jest.fn(async () => []), getById: jest.fn(async () => found) };
  const authorities = { list: jest.fn(async () => []) };
  return { svc: new SchemeService(schemes as any, authorities as any) };
}

describe('SchemeService', () => {
  it('checks eligibility (delegates to the scheme evaluator, carries the version)', async () => {
    const { svc } = harness(scheme);
    const res = await svc.checkEligibility('t1', 's1', { roles: ['farmer'] });
    expect(res.eligible).toBe(true); expect(res.schemeVersion).toBe(2);
  });
  it('throws a typed 404 for a missing scheme', async () => {
    const { svc } = harness(null);
    await expect(svc.getById('t1', 'x')).rejects.toBeInstanceOf(SchemeNotFoundError);
    await expect(svc.checkEligibility('t1', 'x', {})).rejects.toBeInstanceOf(SchemeNotFoundError);
  });
});
