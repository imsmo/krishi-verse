// modules/fintech/__tests__/tenant-isolation.spec.ts · tenant-scoping SQL contract (CI gate).
// Loan applications + loans + repayments bind tenant_id (Law 1). No version columns → mutations lock FOR
// UPDATE. Lists are keyset (never OFFSET). financial_partners + loan_products are GLOBAL reference data
// (no tenant_id). The application read JOINs loan_products for the partner_id (FOR UPDATE OF a).
import { LoanApplicationRepository } from '../repositories/loan-application.repository';
import { LoanRepository } from '../repositories/loan.repository';
import { LoanRepaymentRepository } from '../repositories/loan-repayment.repository';
import { FinancialPartnerRepository } from '../repositories/financial-partner.repository';
import { LoanProductRepository } from '../repositories/loan-product.repository';
import { Loan } from '../domain/loan.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }

describe('loan_applications isolation', () => {
  it('getForUpdate binds tenant_id + FOR UPDATE OF a (JOINs product for partner)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new LoanApplicationRepository(fakeReplica().provider).getForUpdate(tx as any, 'tA', 'a1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/a\.id=\$1 AND a\.tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE OF a/);
    expect(sql).toMatch(/JOIN loan_products lp ON lp\.id = a\.product_id/); expect(params).toEqual(['a1', 'tA']);
  });
  it('review-queue listFor filters submitted/under_review, keyset (no OFFSET)', async () => {
    const { provider, exec } = fakeReplica();
    await new LoanApplicationRepository(provider).listFor('tA', { reviewQueue: true, limit: 50 });
    const [sql] = exec.query.mock.calls[0];
    expect(sql).toMatch(/a\.status IN \('submitted','under_review'\)/); expect(sql).not.toMatch(/OFFSET/i);
  });
});

describe('loans + loan_repayments isolation', () => {
  it('loan getForUpdate binds tenant_id + FOR UPDATE; insert binds tenant_id', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new LoanRepository(fakeReplica().provider).getForUpdate(tx as any, 'tA', 'l1');
    expect(tx.query.mock.calls[0][0]).toMatch(/id=\$1 AND tenant_id=\$2/); expect(tx.query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
    const tx2 = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const l = Loan.open({ id: 'l1', applicationId: 'a1', tenantId: 'tA', borrowerUserId: 'u1', partnerId: 'pn1', principalMinor: 1000n, interestAprBps: 1100, disbursedAt: '2026-06-20', maturityDate: null, nextDueDate: null });
    await new LoanRepository(fakeReplica().provider).insert(tx2 as any, l);
    expect(tx2.query.mock.calls[0][1]).toContain('tA');
  });
  it('loan listFor keyset (no OFFSET); repayment listForLoan bounds created_at (partition prune)', async () => {
    const { provider, exec } = fakeReplica();
    await new LoanRepository(provider).listFor('tA', { limit: 50 });
    expect(exec.query.mock.calls[0][0]).not.toMatch(/OFFSET/i);
    const { provider: p2, exec: e2 } = fakeReplica();
    await new LoanRepaymentRepository(p2).listForLoan('tA', 'l1');
    const [sql, params] = e2.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND loan_id=\$2/); expect(sql).toMatch(/created_at >= now\(\) - interval/); expect(params).toEqual(['tA', 'l1']);
  });
});

describe('global reference data (no tenant scoping on the rows)', () => {
  it('partners + products list without a tenant_id predicate', async () => {
    const { provider, exec } = fakeReplica();
    await new FinancialPartnerRepository(provider).list('tA', { activeOnly: true });
    expect(exec.query.mock.calls[0][0]).not.toMatch(/tenant_id/);
    const { provider: p2, exec: e2 } = fakeReplica();
    await new LoanProductRepository(p2).list('tA', { activeOnly: true });
    expect(e2.query.mock.calls[0][0]).not.toMatch(/tenant_id/);
  });
});
