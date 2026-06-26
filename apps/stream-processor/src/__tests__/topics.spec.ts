import { topicForEvent, partitionKey, TOPICS, PLATFORM_KEY, CONSUMER_SUBSCRIPTIONS, INGEST_TOPICS } from '../topics';

describe('topicForEvent', () => {
  it('routes by aggregate family', () => {
    expect(topicForEvent('orders.order_created')).toBe(TOPICS.orders);
    expect(topicForEvent('auctions.bid_placed')).toBe(TOPICS.auctions);
    expect(topicForEvent('dairy.collection_recorded')).toBe(TOPICS.dairy);
    expect(topicForEvent('listings.listing_published')).toBe(TOPICS.catalogue);
    expect(topicForEvent('payments.payout_executed')).toBe(TOPICS.payments);
    expect(topicForEvent('views.listing_viewed')).toBe(TOPICS.views);   // P1-15: own topic, not catalogue
  });
  it('never drops an unmapped family — catch-all', () => {
    expect(topicForEvent('weird.something')).toBe(TOPICS.events);
    expect(topicForEvent('')).toBe(TOPICS.events);
  });
});

describe('partitionKey', () => {
  it('keys by tenant, falling back to a platform key', () => {
    expect(partitionKey('t1')).toBe('t1');
    expect(partitionKey(null)).toBe(PLATFORM_KEY);
    expect(partitionKey(undefined)).toBe(PLATFORM_KEY);
    expect(partitionKey('')).toBe(PLATFORM_KEY);
  });
});

describe('consumer subscriptions', () => {
  it('each concern has a distinct group id and subscribes only to known ingest topics', () => {
    const groups = Object.values(CONSUMER_SUBSCRIPTIONS).map((s) => s.groupId);
    expect(new Set(groups).size).toBe(groups.length);   // unique groups → independent consumption
    for (const s of Object.values(CONSUMER_SUBSCRIPTIONS)) {
      for (const top of s.topics) expect(INGEST_TOPICS).toContain(top);
    }
  });
});
