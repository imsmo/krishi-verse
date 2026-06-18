// modules/disputes/__tests__/dispute-refunded.handler.spec.ts · unit: payments.dispute_refunded →
// stamps resolution_txn_id on the dispute (idempotent). Mocks the repo.
import { DisputeRefundedHandler } from '../events/handlers/dispute-refunded.handler';

const tenantId = 't1', disputeId = 'dsp1', txnId = 'txn1';
const evt = (over: any = {}) => ({ id: '1', tenantId, aggregateType: 'dispute', aggregateId: disputeId, eventType: 'payments.dispute_refunded', payload: { v: 1, disputeId, txnId, ...over } });

describe('DisputeRefundedHandler', () => {
  it('stamps the reversal txn id on the dispute', async () => {
    const repo = { stampResolutionTxn: jest.fn().mockResolvedValue(undefined) } as any;
    const tx = { query: jest.fn() } as any;
    await new DisputeRefundedHandler(repo).handle(evt() as any, tx);
    expect(repo.stampResolutionTxn).toHaveBeenCalledWith(tx, tenantId, disputeId, txnId);
  });
  it('ignores a malformed event (no txnId)', async () => {
    const repo = { stampResolutionTxn: jest.fn() } as any;
    await new DisputeRefundedHandler(repo).handle(evt({ txnId: undefined }) as any, { query: jest.fn() } as any);
    expect(repo.stampResolutionTxn).not.toHaveBeenCalled();
  });
});
