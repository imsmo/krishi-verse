// apps/stream-processor/src/consumers/fraud-signal.consumer.ts · scores order/payment/auction events for fraud
// and, when the score crosses the threshold, PRODUCES a signal to kv.fraud.signals. It NEVER takes an automated
// money/account action — a signal is advisory and is consumed by the ai-governance human review queue / admin
// risk tooling (Law 11: enforcement is server-authoritative, with a human in the loop). Scoring is the pure,
// unit-tested fraud/scoring rules over features derived from the event payload. Richer cross-event velocity
// (rolling per-actor windows, device graphs) is the feature-store's job (apps/ai-services) — flagged, not faked.
import type { ConsumerSpec, ConsumerContext } from '../messaging/consumer-runtime';
import { CONSUMER_SUBSCRIPTIONS, TOPICS, partitionKey } from '../topics';
import type { StreamEvent } from '../envelope';
import { scoreEvent, parseAmountMinor, FraudFeature } from '../fraud/scoring';

/** Build a feature vector from the event payload. Fields the producing module includes are used; absent signals
 *  default to benign so we never over-flag on missing data (fail safe). */
function featureFor(ev: StreamEvent): { feature: FraudFeature; actorUserId: string | null } {
  const p = ev.payload;
  const num = (k: string) => (typeof p[k] === 'number' ? (p[k] as number) : 0);
  const actor = typeof p.buyerUserId === 'string' ? p.buyerUserId : (typeof p.userId === 'string' ? p.userId : null);
  return {
    actorUserId: actor,
    feature: {
      amountMinor: parseAmountMinor(p.amountMinor ?? p.totalMinor),
      ordersInWindow: num('ordersInWindow'),
      failedPaymentsInWindow: num('failedPaymentsInWindow') + (ev.eventType === 'payments.payment_failed' ? 1 : 0),
      accountAgeDays: typeof p.accountAgeDays === 'number' ? (p.accountAgeDays as number) : 365,
      distinctDevicesInWindow: num('distinctDevicesInWindow') || 1,
    },
  };
}

export function fraudSignalConsumer(): ConsumerSpec {
  const sub = CONSUMER_SUBSCRIPTIONS.fraud_signal;
  return {
    concern: sub.concern,
    groupId: sub.groupId,
    topics: sub.topics,
    async handle(ev: StreamEvent, ctx: ConsumerContext): Promise<void> {
      const { feature, actorUserId } = featureFor(ev);
      const assessment = scoreEvent(feature);
      if (!assessment.flagged) return;                               // nothing to signal
      // Emit an advisory signal for the review queue. No PII beyond ids; amounts stay string minor units.
      const signal = {
        v: 1,
        tenantId: ev.tenantId,
        sourceEventId: ev.eventId,
        eventType: ev.eventType,
        actorUserId,
        aggregateId: ev.aggregateId,
        score: assessment.score,
        reasons: assessment.reasons,
        at: new Date().toISOString(),
      };
      await ctx.producer.send(TOPICS.fraudSignals, partitionKey(ev.tenantId), JSON.stringify(signal));
    },
  };
}
