// Backpressure policy: bounded subscriptions + slow-consumer eviction protect the pod at scale (§5/§6).
import { canAddSubscription, isSlowConsumer, decideSend, DEFAULT_LIMITS } from '../backpressure/policy';

const L = { maxSubscriptions: 3, maxBufferedBytes: 1000, maxQueuedMessages: 10 };

describe('subscription bound', () => {
  it('caps subscriptions per socket', () => {
    expect(canAddSubscription(2, L)).toBe(true);
    expect(canAddSubscription(3, L)).toBe(false);
  });
});

describe('slow consumer detection', () => {
  it('flags a backed-up send buffer or queue', () => {
    expect(isSlowConsumer(1001, 0, L)).toBe(true);
    expect(isSlowConsumer(0, 11, L)).toBe(true);
    expect(isSlowConsumer(500, 5, L)).toBe(false);
  });
});

describe('send decision', () => {
  it('sends when healthy, sheds near the cap, evicts when stuck', () => {
    expect(decideSend(0, 0, L)).toBe('send');
    expect(decideSend(0, 8, L)).toBe('drop_oldest');   // 80% of 10
    expect(decideSend(2000, 0, L)).toBe('evict');
    expect(decideSend(0, 11, L)).toBe('evict');
  });
  it('has sane defaults', () => {
    expect(decideSend(0, 0, DEFAULT_LIMITS)).toBe('send');
  });
});
