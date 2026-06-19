// modules/exports/__tests__/exporter-registration.service.spec.ts · ExporterRegistrationService unit tests (fakes).
// Pins: register drains exporter_registered to the outbox in-tx (Law 4) + authz THROWS (Law 6); edit is owner-only.
import { ExporterRegistrationService } from '../services/exporter-registration.service';
import { ExporterRegistration } from '../domain/exporter-registration.entity';
import { ExportsForbiddenError } from '../domain/exports.errors';

function harness(existing: ExporterRegistration | null) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() }; const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const repo = { insert: jest.fn(), getForUpdate: jest.fn(async () => existing), update: jest.fn(), getById: jest.fn(), listFor: jest.fn() };
  const svc = new ExporterRegistrationService(uow as any, outbox as any, idem as any, metrics as any, repo as any);
  return { svc, outbox };
}
const exporter = { userId: 'exp1', canManage: true, isAdmin: false };

describe('ExporterRegistrationService.register', () => {
  it('persists + emits exporter_registered', async () => {
    const { svc, outbox } = harness(null);
    const out = await svc.register('t1', exporter, 'idem-1', { authority: 'APEDA', regNo: 'RCMC-123' } as any);
    expect(out.authority).toBe('APEDA');
    expect(outbox.write.mock.calls[0][1].eventType).toBe('exports.exporter_registered');
  });
  it('requires export.manage', async () => {
    const { svc } = harness(null);
    await expect(svc.register('t1', { ...exporter, canManage: false }, 'idem-2', { authority: 'APEDA', regNo: 'X' } as any)).rejects.toBeInstanceOf(ExportsForbiddenError);
  });
});

describe('ExporterRegistrationService.update authz', () => {
  it('forbids editing another exporter\'s registration', async () => {
    const other = ExporterRegistration.register({ id: 'e1', tenantId: 't1', exporterUserId: 'someone', authority: 'APEDA', regNo: 'R', iecCode: null, validUntil: null, docId: null });
    const { svc } = harness(other);
    await expect(svc.update('t1', exporter, 'e1', { iecCode: 'ABCDE12345' } as any)).rejects.toBeInstanceOf(ExportsForbiddenError);
  });
});
