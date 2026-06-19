// modules/exports/__tests__/export-shipment.service.spec.ts · ship-gate unit test (fakes).
// Pins the compliance gate: a shipment can advance to 'shipped' ONLY when it has ≥1 document and every
// document is verified; otherwise DocsNotClearedError and the status does NOT change.
import { ExportShipmentService } from '../services/export-shipment.service';
import { ExportShipment } from '../domain/export-shipment.entity';
import { DocsNotClearedError } from '../domain/exports.errors';

function inspectionShipment() {
  const s = ExportShipment.create({ id: 's1', tenantId: 't1', exporterUserId: 'exp1', destinationCountry: 'US', incoterm: 'FOB', orderIds: [], vesselOrAwb: null, lcRef: null, totalValueMinor: null, currencyCode: 'USD' });
  s.advance('docs_in_progress'); s.advance('inspection'); s.pullEvents();
  return s;
}
function harness(docCounts: { total: number; notVerified: number }) {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() }; const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const quota = { assertWithinLimit: jest.fn(), increment: jest.fn() }; const metrics = { inc: jest.fn(), observe: jest.fn() }; const audit = { write: jest.fn() };
  const repo = { getForUpdate: jest.fn(async () => inspectionShipment()), update: jest.fn() };
  const docs = { countNotVerified: jest.fn(async () => docCounts) };
  const svc = new ExportShipmentService(uow as any, outbox as any, idem as any, quota as any, metrics as any, audit as any, repo as any, docs as any);
  return { svc, repo };
}
const exporter = { userId: 'exp1', canManage: true, isAdmin: false };

describe('advance to shipped — docs gate', () => {
  it('blocks shipping when documents are not all verified', async () => {
    const { svc, repo } = harness({ total: 3, notVerified: 1 });
    await expect(svc.advance('t1', exporter, 's1', { to: 'shipped' } as any, null)).rejects.toBeInstanceOf(DocsNotClearedError);
    expect(repo.update).not.toHaveBeenCalled();
  });
  it('blocks shipping when there are no documents at all', async () => {
    const { svc } = harness({ total: 0, notVerified: 0 });
    await expect(svc.advance('t1', exporter, 's1', { to: 'shipped' } as any, null)).rejects.toBeInstanceOf(DocsNotClearedError);
  });
  it('allows shipping when every document is verified', async () => {
    const { svc, repo } = harness({ total: 3, notVerified: 0 });
    const out = await svc.advance('t1', exporter, 's1', { to: 'shipped' } as any, null);
    expect(out.status).toBe('shipped'); expect(repo.update).toHaveBeenCalledTimes(1);
  });
});
