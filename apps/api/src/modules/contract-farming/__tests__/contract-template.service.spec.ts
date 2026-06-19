// modules/contract-farming/__tests__/contract-template.service.spec.ts · TemplateService unit tests (fakes).
// Pins: create drains template_created to the outbox in-tx (Law 4) + authz THROWS (Law 6).
import { ContractTemplateService } from '../services/contract-template.service';
import { ContractFarmingForbiddenError } from '../domain/contract-farming.errors';

function harness() {
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn() }; const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const repo = { insert: jest.fn(), getUsable: jest.fn(), list: jest.fn() };
  const svc = new ContractTemplateService(uow as any, outbox as any, idem as any, metrics as any, repo as any);
  return { svc, outbox, repo };
}
const buyer = { userId: 'b1', canManage: true, isAdmin: false };

describe('ContractTemplateService.create', () => {
  it('persists + emits template_created', async () => {
    const { svc, outbox, repo } = harness();
    const out = await svc.create('t1', buyer, 'idem-1', { defaultName: 'Model Act forward', bodyTemplate: 'Whereas {{buyer}}…', clauses: [] } as any);
    expect(repo.insert).toHaveBeenCalledTimes(1); expect(out.defaultName).toBe('Model Act forward');
    expect(outbox.write.mock.calls[0][1].eventType).toBe('contract_farming.template_created');
  });
  it('requires contract.manage', async () => {
    const { svc } = harness();
    await expect(svc.create('t1', { ...buyer, canManage: false }, 'idem-2', { defaultName: 'X', bodyTemplate: 'Y', clauses: [] } as any)).rejects.toBeInstanceOf(ContractFarmingForbiddenError);
  });
});
