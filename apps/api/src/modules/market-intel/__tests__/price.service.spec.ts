// modules/market-intel/__tests__/price.service.spec.ts · service unit tests with fakes.
// Pins: ingest requires market.manage; ingest fires only the alerts CROSSED by the modal (emits one event each);
// prediction.generate requires market.manage + uses the baseline band; alert toggle 404s a non-owner (no IDOR).
import { MandiPriceService } from '../services/mandi-price.service';
import { PricePredictionService } from '../services/price-prediction.service';
import { PriceAlertService } from '../services/price-alert.service';
import { PriceAlert } from '../domain/price-alert.entity';
import { MarketForbiddenError, PriceAlertNotFoundError } from '../domain/market-intel.errors';

const alert = (dir: any, thr: bigint, user = 'u1') => PriceAlert.rehydrate({ id: `al-${dir}-${thr}`, tenantId: 't1', userId: user, productId: 'p1', regionId: 'r1', direction: dir, thresholdMinor: thr, isActive: true });

function priceHarness(opts: { matching?: PriceAlert[] } = {}) {
  const writes: any[] = [];
  const tx = { query: jest.fn() };
  const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
  const outbox = { write: jest.fn(async (_tx: any, e: any) => { writes.push(e); }) };
  const idem = { remember: jest.fn(async (_k: string, _u: string, _e: string, fn: any) => fn()) };
  const metrics = { inc: jest.fn(), observe: jest.fn() };
  const prices = { insert: jest.fn(), recentModals: jest.fn() };
  // insertTrigger: the P1-3 per-user trigger-log append (PriceAlertRepository.insertTrigger) — the service
  // calls it once per crossed alert, in-tx, alongside the PriceAlertTriggered outbox event.
  const alerts = { matchActive: jest.fn(async () => opts.matching ?? []), insertTrigger: jest.fn(async () => undefined) };
  const names = { resolveCommodityName: jest.fn(), resolveMandiName: jest.fn() }; // MarketNamesReadModel stub (7th dep)
  const svc = new MandiPriceService(uow as any, outbox as any, idem as any, metrics as any, prices as any, alerts as any, names as any);
  return { svc, writes, prices, alerts };
}
const ops = { userId: 'ops', canManage: true };
const learner = { userId: 'u1', canManage: false };

describe('MandiPriceService.ingest', () => {
  it('requires market.manage', async () => {
    const h = priceHarness();
    await expect(h.svc.ingest('t1', learner, 'idem-1', { productId: 'p1', priceDate: '2026-06-20', modalMinor: '250000', unitCode: 'quintal', source: 'ambassador_manual' } as any)).rejects.toBeInstanceOf(MarketForbiddenError);
  });
  it('fires only the crossed alerts (one event each) + a PriceIngested event', async () => {
    const h = priceHarness({ matching: [alert('above', 200000n), alert('above', 900000n), alert('below', 300000n)] });
    const out = await h.svc.ingest('t1', ops, 'idem-2', { regionId: 'r1', productId: 'p1', priceDate: '2026-06-20', modalMinor: '250000', unitCode: 'quintal', source: 'agmarknet' } as any);
    // modal 250000: above@200000 ✓, above@900000 ✗, below@300000 ✓ → 2 fired
    expect(out.alertsFired).toBe(2);
    expect(h.writes.filter((e) => e.eventType === 'market.price_alert_triggered')).toHaveLength(2);
    expect(h.writes.some((e) => e.eventType === 'market.price_ingested')).toBe(true);
    // P1-3: the trigger-log append runs once per CROSSED alert, in the same tx as the outbox event.
    expect(h.alerts.insertTrigger).toHaveBeenCalledTimes(2);
  });
});

describe('PricePredictionService.generate', () => {
  function predHarness(modals: bigint[]) {
    const tx = { query: jest.fn() };
    const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
    const outbox = { write: jest.fn() };
    const metrics = { inc: jest.fn(), observe: jest.fn() };
    const predictions = { insert: jest.fn(), latest: jest.fn() };
    const prices = { recentModals: jest.fn(async () => modals) };
    const svc = new PricePredictionService(uow as any, outbox as any, metrics as any, predictions as any, prices as any);
    return { svc, predictions };
  }
  it('requires market.manage', async () => {
    const h = predHarness([1n, 2n, 3n]);
    await expect(h.svc.generate('t1', learner, { productId: 'p1', regionId: 'r1', targetDate: '2026-06-25', lookbackDays: 90 } as any)).rejects.toBeInstanceOf(MarketForbiddenError);
  });
  it('stores a baseline band from recent modals', async () => {
    const h = predHarness([100n, 200n, 300n, 400n, 500n]);
    const out = await h.svc.generate('t1', ops, { productId: 'p1', regionId: 'r1', targetDate: '2026-06-25', lookbackDays: 90 } as any);
    expect(out.modelVersion).toBe('baseline-v1'); expect(h.predictions.insert).toHaveBeenCalledTimes(1);
  });
});

describe('PriceAlertService.setActive', () => {
  it('404s a non-owner (no IDOR)', async () => {
    const tx = { query: jest.fn() };
    const uow = { run: jest.fn(async (_t: string, fn: any) => fn(tx)) };
    const repo = { getForUpdate: jest.fn(async () => alert('above', 100n, 'someone-else')), update: jest.fn() };
    const svc = new PriceAlertService(uow as any, { write: jest.fn() } as any, { inc: jest.fn(), observe: jest.fn() } as any, repo as any);
    await expect(svc.setActive('t1', learner, 'al-above-100', false)).rejects.toBeInstanceOf(PriceAlertNotFoundError);
  });
});
