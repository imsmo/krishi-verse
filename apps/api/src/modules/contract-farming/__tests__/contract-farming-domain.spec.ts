// modules/contract-farming/__tests__/contract-farming-domain.spec.ts · pure-domain unit tests: the contract
// state machine, the FLOAT-FREE fixed-price settlement gross, the input-advance recovery math, and grower
// enrolment invariants. No infra — UoW/outbox/wallet are the integration + service specs.
import { canTransition, isActive, acceptsEnrolment, CONTRACT_STATUSES, ContractStatus, IllegalContractTransitionError } from '../domain/farming-contract.state';
import { FarmingContract } from '../domain/farming-contract.entity';
import { InputAdvance } from '../domain/input-advance.entity';
import { ContractGrower } from '../domain/contract-grower.entity';
import { ContractFarmingEventType } from '../domain/contract-farming.events';
import { InvalidContractError, UnsupportedPriceModelError, InvalidGrowerError } from '../domain/contract-farming.errors';

const fixed = (over: any = {}) => FarmingContract.create({ id: 'c1', tenantId: 't1', contractNo: 'CF-X', templateId: null, buyerUserId: 'buyer1', contractKind: 'forward',
  productId: 'p1', totalQuantityMilli: 100000n, unitCode: 'quintal', priceModel: 'fixed', priceTerms: { fixed_minor: '50000' }, qualitySpec: {}, season: 'rabi-2026', ...over });

describe('contract.state machine', () => {
  it('draft→proposed→signed→active→fulfilled; terminate from mid-states', () => {
    expect(canTransition('draft', 'proposed')).toBe(true);
    expect(canTransition('proposed', 'signed')).toBe(true);
    expect(canTransition('signed', 'active')).toBe(true);
    expect(canTransition('active', 'fulfilled')).toBe(true);
    expect(canTransition('draft', 'active')).toBe(false);
    expect(canTransition('fulfilled', 'active')).toBe(false);
    expect(isActive('active')).toBe(true);
    expect(acceptsEnrolment('draft')).toBe(true); expect(acceptsEnrolment('active')).toBe(true); expect(acceptsEnrolment('fulfilled')).toBe(false);
    for (const s of CONTRACT_STATUSES) expect(() => canTransition(s, 'terminated' as ContractStatus)).not.toThrow();
    expect(new IllegalContractTransitionError('fulfilled', 'draft').code).toBe('CONTRACT_ILLEGAL_TRANSITION');
  });
});

describe('FarmingContract — fixed-price settlement (float-free)', () => {
  it('gross = delivered qty × fixed price (10.000 qtl × ₹500 = ₹5000) EXACT', () => {
    expect(fixed().settlementGrossMinor(10000n)).toBe(500000n);   // 10000 milli × 50000 / 1000
  });
  it('requires fixed_minor at creation; rejects non-fixed settlement', () => {
    expect(() => fixed({ priceTerms: {} })).toThrow(InvalidContractError);
    const formula = fixed({ priceModel: 'formula', priceTerms: { f: 1 } });
    expect(() => formula.settlementGrossMinor(10000n)).toThrow(UnsupportedPriceModelError);
  });
  it('lifecycle emits the right events', () => {
    const c = fixed(); c.pullEvents();
    c.propose(); c.sign(new Date()); c.activate(); c.fulfill();
    expect(c.status).toBe('fulfilled');
    expect(c.pullEvents().map((e) => e.type)).toEqual([ContractFarmingEventType.ContractProposed, ContractFarmingEventType.ContractSigned, ContractFarmingEventType.ContractActivated, ContractFarmingEventType.ContractFulfilled]);
  });
});

describe('InputAdvance recovery math', () => {
  it('recovers up to the outstanding balance; outstanding shrinks', () => {
    const a = InputAdvance.disburse({ id: 'a1', contractId: 'c1', growerId: 'g1', tenantId: 't1', productId: null, description: null, valueMinor: 200000n });
    expect(a.outstandingMinor).toBe(200000n);
    expect(a.recover(50000n)).toBe(50000n); expect(a.outstandingMinor).toBe(150000n);
    expect(a.recover(999999n)).toBe(150000n); expect(a.outstandingMinor).toBe(0n);   // capped at outstanding
    expect(a.recover(10000n)).toBe(0n);                                               // nothing left
  });
  it('rejects a non-positive advance value', () => {
    expect(() => InputAdvance.disburse({ id: 'a', contractId: 'c', growerId: 'g', tenantId: 't', productId: null, description: null, valueMinor: 0n })).toThrow();
  });
});

describe('ContractGrower enrolment', () => {
  it('rejects non-positive committed quantity', () => {
    expect(() => ContractGrower.enrol({ id: 'g', contractId: 'c', tenantId: 't', farmerUserId: 'f', landParcelId: null, committedQuantityMilli: 0n })).toThrow(InvalidGrowerError);
  });
});
