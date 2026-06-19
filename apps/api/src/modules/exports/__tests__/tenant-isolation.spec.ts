// modules/exports/__tests__/tenant-isolation.spec.ts · tenant-scoping SQL contract (CI gate).
// Every exporter/shipment/document read+write binds tenant_id (Law 1). No version columns → mutations lock
// FOR UPDATE. Lists are keyset (never OFFSET). The export_doc lookup resolves platform-scoped (tenant_id IS
// NULL). compliance_requirements is GLOBAL reference data, queried by destination + effective-date.
import { ExporterRegistrationRepository } from '../repositories/exporter-registration.repository';
import { ExportShipmentRepository } from '../repositories/export-shipment.repository';
import { ExportDocumentRepository } from '../repositories/export-document.repository';
import { ComplianceRequirementRepository } from '../repositories/compliance-requirement.repository';
import { ExportShipment } from '../domain/export-shipment.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }

describe('exporter_registrations isolation', () => {
  it('getForUpdate binds tenant_id + FOR UPDATE', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new ExporterRegistrationRepository(fakeReplica().provider).getForUpdate(tx as any, 'tA', 'e1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/); expect(params).toEqual(['e1', 'tA']);
  });
  it('listFor keyset (no OFFSET)', async () => {
    const { provider, exec } = fakeReplica();
    await new ExporterRegistrationRepository(provider).listFor('tA', { limit: 50 });
    expect(exec.query.mock.calls[0][0]).toMatch(/tenant_id=\$1/); expect(exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
  });
});

describe('export_shipments isolation', () => {
  it('getForUpdate binds tenant_id + FOR UPDATE; insert binds tenant_id', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new ExportShipmentRepository(fakeReplica().provider).getForUpdate(tx as any, 'tA', 's1');
    expect(tx.query.mock.calls[0][0]).toMatch(/id=\$1 AND tenant_id=\$2/); expect(tx.query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
    const tx2 = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const s = ExportShipment.create({ id: 's1', tenantId: 'tA', exporterUserId: 'e1', destinationCountry: 'US', incoterm: null, orderIds: [], vesselOrAwb: null, lcRef: null, totalValueMinor: null, currencyCode: 'USD' });
    await new ExportShipmentRepository(fakeReplica().provider).insert(tx2 as any, s);
    expect(tx2.query.mock.calls[0][1]).toContain('tA');
  });
  it('listFor keyset (no OFFSET)', async () => {
    const { provider, exec } = fakeReplica();
    await new ExportShipmentRepository(provider).listFor('tA', { limit: 50 });
    expect(exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
  });
});

describe('export_documents isolation + doc-type resolution', () => {
  it('resolveDocTypeId is platform-scoped (tenant_id IS NULL), never a client id', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'dt1' }], rowCount: 1 }) };
    await new ExportDocumentRepository(fakeReplica().provider).resolveDocTypeId(tx as any, 'commercial_invoice');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/type_code='export_doc'/); expect(sql).toMatch(/tenant_id IS NULL/); expect(params).toEqual(['commercial_invoice']);
  });
  it('countNotVerified binds tenant + shipment (the ship gate)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [{ total: 0, not_verified: 0 }], rowCount: 1 }) };
    await new ExportDocumentRepository(fakeReplica().provider).countNotVerified(tx as any, 'tA', 's1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND shipment_id=\$2/); expect(sql).toMatch(/FILTER \(WHERE status <> 'verified'\)/); expect(params).toEqual(['tA', 's1']);
  });
});

describe('compliance_requirements (global reference data)', () => {
  it('listInEffect filters destination + effective-date (no tenant scoping on the rows)', async () => {
    const { provider, exec } = fakeReplica();
    await new ComplianceRequirementRepository(provider).listInEffect('tA', 'US');
    const [sql, params] = exec.query.mock.calls[0];
    expect(sql).toMatch(/destination_country=\$1/); expect(sql).toMatch(/effective_from <= CURRENT_DATE AND \(effective_to IS NULL OR effective_to >= CURRENT_DATE\)/);
    expect(params).toEqual(['US']);
  });
});
