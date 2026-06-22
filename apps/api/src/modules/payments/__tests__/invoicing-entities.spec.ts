// modules/payments/__tests__/invoicing-entities.spec.ts · pure-domain unit tests for the API-W3-07 value objects:
// SettlementStatement (zero-sum invariant), TradeInvoice (GST split consistency), ChargeDefinition (per-method
// config validation), TaxRule (rate + split). All money is bigint minor units. Service-level UoW/RLS is covered by
// the commission-rule integration spec.
import { SettlementStatement } from '../domain/settlement-statement.entity';
import { TradeInvoice } from '../domain/trade-invoice.entity';
import { ChargeDefinition, assertChargeConfig } from '../domain/charge-definition.entity';
import { TaxRule } from '../domain/tax-rule.entity';
import { SettlementConfigError, InvalidTaxRuleError, InvalidChargeDefinitionError } from '../domain/commission.errors';
import { InvalidTradeInvoiceError } from '../domain/billing.errors';

describe('SettlementStatement', () => {
  const base = { id: 's1', tenantId: 't1', sellerUserId: 'u1', statementNo: 'STMT-2026-07-000001', periodStart: '2026-07-01', periodEnd: '2026-07-31' };
  it('derives + validates net = gross − commission − tax', () => {
    const s = SettlementStatement.fromAggregate({ ...base, grossMinor: 100000n, commissionMinor: 3500n, taxMinor: 630n });
    expect(s.netMinor).toBe(95870n); expect(s.isZero).toBe(false);
  });
  it('rejects a supplied net that disagrees, a negative net, and a bad window', () => {
    expect(() => SettlementStatement.fromAggregate({ ...base, grossMinor: 100000n, commissionMinor: 3500n, taxMinor: 630n, netMinor: 99999n })).toThrow(SettlementConfigError);
    expect(() => SettlementStatement.fromAggregate({ ...base, grossMinor: 100n, commissionMinor: 200n, taxMinor: 0n })).toThrow(SettlementConfigError);
    expect(() => SettlementStatement.fromAggregate({ ...base, periodStart: '2026-07-31', periodEnd: '2026-07-01', grossMinor: 1n, commissionMinor: 0n, taxMinor: 0n })).toThrow(SettlementConfigError);
  });
});

describe('TradeInvoice', () => {
  const base = { id: 'i1', tenantId: 't1', orderId: 'o1', invoiceNo: 'INV-2026-000001', sellerGstin: null, buyerGstin: null };
  it('accepts a consistent intra-state CGST/SGST split', () => {
    const inv = TradeInvoice.create({ ...base, totalMinor: 118000n, tax: { gstRateBps: 1800, taxableMinor: 100000n, cgstMinor: 9000n, sgstMinor: 9000n, igstMinor: 0n } });
    expect(inv.taxMinor).toBe(18000n);
  });
  it('rejects mixing IGST with CGST/SGST, tax over total, and a bad GSTIN', () => {
    expect(() => TradeInvoice.create({ ...base, totalMinor: 100n, tax: { gstRateBps: 0, taxableMinor: 0n, cgstMinor: 5n, sgstMinor: 0n, igstMinor: 5n } })).toThrow(InvalidTradeInvoiceError);
    expect(() => TradeInvoice.create({ ...base, totalMinor: 100n, tax: { gstRateBps: 0, taxableMinor: 0n, cgstMinor: 200n, sgstMinor: 0n, igstMinor: 0n } })).toThrow(InvalidTradeInvoiceError);
    expect(() => TradeInvoice.create({ ...base, sellerGstin: 'NOTAGSTIN', totalMinor: 0n, tax: { gstRateBps: 0, taxableMinor: 0n, cgstMinor: 0n, sgstMinor: 0n, igstMinor: 0n } })).toThrow(InvalidTradeInvoiceError);
  });
});

describe('ChargeDefinition config validation', () => {
  it('validates each calc_method', () => {
    expect(() => assertChargeConfig('flat', { fee_minor: 5000 })).not.toThrow();
    expect(() => assertChargeConfig('flat', {})).toThrow(InvalidChargeDefinitionError);
    expect(() => assertChargeConfig('percent', { bps: 250 })).not.toThrow();
    expect(() => assertChargeConfig('percent', { bps: -1 })).toThrow(InvalidChargeDefinitionError);
    expect(() => assertChargeConfig('slab', { slabs: [{ upto_minor: 100000, fee_minor: 2000 }, { upto_minor: null, fee_minor: 5000 }] })).not.toThrow();
    expect(() => assertChargeConfig('slab', { slabs: [] })).toThrow(InvalidChargeDefinitionError);
  });
  it('create() validates code + method + config', () => {
    const cd = ChargeDefinition.create({ id: 'c1', tenantId: null, chargeCode: 'buyer_platform_fee', calcMethod: 'percent', config: { bps: 200 }, currencyCode: 'INR', effectiveFrom: '2026-01-01', effectiveTo: null, isActive: true });
    expect(cd.scope).toBe('platform');
    expect(() => ChargeDefinition.create({ id: 'c2', tenantId: 't1', chargeCode: 'x', calcMethod: 'percent' as any, config: {}, currencyCode: 'INR', effectiveFrom: '2026-01-01', effectiveTo: null, isActive: true })).toThrow(InvalidChargeDefinitionError);
  });
});

describe('TaxRule', () => {
  const base = { id: 'tr1', countryCode: 'IN', taxCode: 'gst', categoryId: null, hsnPrefix: null, thresholdMinor: null, effectiveFrom: '2026-01-01', effectiveTo: null, isActive: true };
  it('validates rate + split sums and projects to values', () => {
    const r = TaxRule.create({ ...base, rateBps: 1800, split: { cgst: 900, sgst: 900 } });
    expect(r.toValues()).toEqual({ rateBps: 1800, thresholdMinor: null });
    expect(r.appliesAt(1n)).toBe(true);
  });
  it('rejects a split that does not sum to the rate, and an out-of-range rate', () => {
    expect(() => TaxRule.create({ ...base, rateBps: 1800, split: { cgst: 900, sgst: 800 } })).toThrow(InvalidTaxRuleError);
    expect(() => TaxRule.create({ ...base, rateBps: 200000, split: {} })).toThrow(InvalidTaxRuleError);
  });
  it('TDS applies only above its threshold', () => {
    const tds = TaxRule.create({ ...base, taxCode: 'tds_194o', rateBps: 100, thresholdMinor: 500000n, split: {} });
    expect(tds.appliesAt(400000n)).toBe(false); expect(tds.appliesAt(500000n)).toBe(true);
  });
});
