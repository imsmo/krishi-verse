// modules/communication/__tests__/messaging-isolation.spec.ts · messaging scoping SQL contract (CI gate).
// conversations bind tenant_id; participants are ALWAYS joined to conversations on tenant_id (no cross-tenant
// membership leak); messages + masked_calls bind tenant_id, list keyset (no OFFSET), and point-update by
// (id, created_at) for partition pruning. The caller's call log = caller OR callee.
import { ConversationRepository } from '../repositories/conversation.repository';
import { MessageRepository } from '../repositories/message.repository';
import { MaskedCallRepository } from '../repositories/masked-call.repository';
import { Message } from '../domain/message.entity';
import { MaskedCall } from '../domain/masked-call.entity';

function fakeReplica() { const exec = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }; return { provider: { forTenant: () => exec } as any, exec }; }

describe('conversations + participants isolation', () => {
  it('getForUpdate binds tenant_id + FOR UPDATE', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    await new ConversationRepository(fakeReplica().provider).getForUpdate(tx as any, 'tenantA', 'c1');
    const [sql, params] = tx.query.mock.calls[0];
    expect(sql).toMatch(/id=\$1 AND tenant_id=\$2/); expect(sql).toMatch(/FOR UPDATE/); expect(params).toEqual(['c1', 'tenantA']);
  });
  it('isParticipant joins participants to conversations on tenant_id (no cross-tenant leak)', async () => {
    const { provider, exec } = fakeReplica();
    await new ConversationRepository(provider).isParticipant('tenantA', 'c1', 'u1');
    const [sql] = exec.query.mock.calls[0];
    expect(sql).toMatch(/JOIN conversations c ON c\.id=cp\.conversation_id/); expect(sql).toMatch(/c\.tenant_id=\$3/);
  });
  it('listForUser is keyset (no OFFSET) and gated by participant membership', async () => {
    const { provider, exec } = fakeReplica();
    await new ConversationRepository(provider).listForUser('tenantA', 'u1', { limit: 50 });
    const [sql] = exec.query.mock.calls[0];
    expect(sql).toMatch(/cp\.user_id=\$2/); expect(sql).toMatch(/ORDER BY c\.created_at DESC, c\.id DESC/); expect(sql).not.toMatch(/OFFSET/i);
  });
});

describe('messages isolation', () => {
  it('insert + list bind tenant_id; list keyset (no OFFSET)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const m = Message.post({ id: 'm1', conversationId: 'c1', tenantId: 'tenantA', senderUserId: 'u1', body: 'hi', voiceMediaId: null, attachmentMediaId: null, isAiGenerated: false });
    await new MessageRepository(fakeReplica().provider).insert(tx as any, m);
    expect(tx.query.mock.calls[0][0]).toMatch(/INSERT INTO messages/); expect(tx.query.mock.calls[0][1]).toContain('tenantA');
    const { provider, exec } = fakeReplica();
    await new MessageRepository(provider).listForConversation('tenantA', 'c1', { limit: 50 });
    const [sql] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND conversation_id=\$2/); expect(sql).not.toMatch(/OFFSET/i);
  });
  it('flag update binds (id, created_at) for partition pruning', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const m = Message.rehydrate({ id: 'm1', conversationId: 'c1', tenantId: 'tenantA', senderUserId: 'u1', body: 'hi', voiceMediaId: null, attachmentMediaId: null, isAiGenerated: false, isFlagged: true, createdAt: new Date() });
    await new MessageRepository(fakeReplica().provider).update(tx as any, m);
    expect(tx.query.mock.calls[0][0]).toMatch(/WHERE id=\$1 AND created_at=\$2/);
  });
});

describe('masked_calls isolation', () => {
  it("listForUser scopes to caller OR callee; keyset (no OFFSET)", async () => {
    const { provider, exec } = fakeReplica();
    await new MaskedCallRepository(provider).listForUser('tenantA', 'u1', { limit: 50 });
    const [sql] = exec.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id=\$1 AND \(caller_user_id=\$2 OR callee_user_id=\$2\)/); expect(sql).not.toMatch(/OFFSET/i);
  });
  it('insert never includes a phone column (only user ids + provider ref)', async () => {
    const tx = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };
    const c = MaskedCall.initiate({ id: 'k1', tenantId: 'tenantA', callerUserId: 'a', calleeUserId: 'b', contextType: null, contextId: null, providerCallRef: 'ref-1' });
    await new MaskedCallRepository(fakeReplica().provider).insert(tx as any, c);
    const [sql] = tx.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO masked_calls/); expect(sql).not.toMatch(/phone/i);
  });
});
