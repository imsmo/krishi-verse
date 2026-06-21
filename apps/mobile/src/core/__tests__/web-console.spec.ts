// Unit tests for the PURE web-console handoff logic (features/tenant/web-console): the 15-report catalogue + the
// safe-URL builder (anti open-redirect). The headline security invariant: only allowlisted https relative paths
// ever become a URL.
import { CORE_REPORTS, WEB_PATHS, isSafeWebPath, buildWebUrl } from '../../features/tenant/web-console';

describe('CORE_REPORTS catalogue', () => {
  it('lists exactly the 15 core reports with unique ids + safe paths', () => {
    expect(CORE_REPORTS).toHaveLength(15);
    const ids = CORE_REPORTS.map((r) => r.id);
    expect(new Set(ids).size).toBe(15);
    for (const r of CORE_REPORTS) {
      expect(r.titleKey.startsWith('owner.report.')).toBe(true);
      expect(isSafeWebPath(r.path)).toBe(true);
    }
  });
});

describe('WEB_PATHS', () => {
  it('every named handoff target is a safe relative path', () => {
    for (const p of Object.values(WEB_PATHS)) expect(isSafeWebPath(p)).toBe(true);
  });
});

describe('isSafeWebPath', () => {
  it('accepts a simple absolute-relative path', () => {
    expect(isSafeWebPath('/reports/gmv')).toBe(true);
    expect(isSafeWebPath('/settings/billing?tab=plan')).toBe(true);
  });
  it('rejects open-redirect / injection attempts', () => {
    expect(isSafeWebPath('//evil.com')).toBe(false);            // protocol-relative
    expect(isSafeWebPath('https://evil.com')).toBe(false);       // absolute URL
    expect(isSafeWebPath('javascript:alert(1)')).toBe(false);    // scheme
    expect(isSafeWebPath('/a/../../etc')).toBe(false);           // traversal
    expect(isSafeWebPath('reports/gmv')).toBe(false);            // no leading slash
    expect(isSafeWebPath('/a b')).toBe(false);                   // whitespace
    expect(isSafeWebPath('')).toBe(false);
  });
});

describe('buildWebUrl', () => {
  it('joins an https base + safe path, trimming trailing slashes', () => {
    expect(buildWebUrl('https://tenant.example.com', '/reports/gmv')).toBe('https://tenant.example.com/reports/gmv');
    expect(buildWebUrl('https://tenant.example.com/', '/reports/gmv')).toBe('https://tenant.example.com/reports/gmv');
  });
  it('returns null for a missing/non-https base or an unsafe path', () => {
    expect(buildWebUrl(undefined, '/reports/gmv')).toBeNull();
    expect(buildWebUrl('http://tenant.example.com', '/reports/gmv')).toBeNull(); // not https
    expect(buildWebUrl('https://tenant.example.com', '//evil.com')).toBeNull();
    expect(buildWebUrl('https://tenant.example.com', 'https://evil.com')).toBeNull();
  });
});
