// apps/web-tenant/src/features/schemes/operator.test.ts · pure unit tests for the schemes operator helpers.
import { officerActions, canRecordDbt, validateDbt, validateEligibility, validateNote, totalDbtMinor } from './operator';

describe('schemes/operator — officer action state machine', () => {
  it('offers the right next actions per status', () => {
    expect(officerActions('submitted')).toEqual(['verify']);
    expect(officerActions('under_verification')).toEqual(['clarify', 'approve', 'reject']);
    expect(officerActions('clarification_needed')).toEqual(['approve', 'reject']);
    expect(officerActions('approved')).toEqual(['close']);
    expect(officerActions('rejected')).toEqual([]);
    expect(officerActions('draft')).toEqual([]);
  });
  it('canRecordDbt only after approval / during disbursal', () => {
    expect(canRecordDbt('approved')).toBe(true);
    expect(canRecordDbt('disbursed')).toBe(true);
    expect(canRecordDbt('submitted')).toBe(false);
    expect(canRecordDbt('rejected')).toBe(false);
  });
});

describe('schemes/operator — validators (float-free)', () => {
  it('validateDbt rejects non-positive-integer amount, bad date, bad instalment', () => {
    expect(validateDbt({ amountMinor: '0', creditedOn: '2026-07-10' })).toBe('amount');
    expect(validateDbt({ amountMinor: '6.5', creditedOn: '2026-07-10' })).toBe('amount');
    expect(validateDbt({ amountMinor: '600000', creditedOn: 'bad' })).toBe('date');
    expect(validateDbt({ amountMinor: '600000', creditedOn: '2026-07-10', instalmentNo: '0' })).toBe('instalment');
    expect(validateDbt({ amountMinor: '600000', creditedOn: '2026-07-10', instalmentNo: '2' })).toBeNull();
    expect(validateDbt({ amountMinor: '600000', creditedOn: '2026-07-10' })).toBeNull();
  });
  it('validateEligibility bounds landholding/age/gender', () => {
    expect(validateEligibility({ landholdingAcres: '-1' })).toBe('landholding');
    expect(validateEligibility({ age: '200' })).toBe('age');
    expect(validateEligibility({ gender: 'robot' })).toBe('gender');
    expect(validateEligibility({ landholdingAcres: '2.5', age: '45', gender: 'female' })).toBeNull();
    expect(validateEligibility({})).toBeNull();
  });
  it('validateNote bounds length', () => {
    expect(validateNote('a'.repeat(1001))).toBe('note');
    expect(validateNote('please attach 7/12 extract')).toBeNull();
    expect(validateNote(undefined)).toBeNull();
  });
  it('totalDbtMinor sums credits float-free', () => {
    expect(totalDbtMinor([{ amountMinor: '600000' }, { amountMinor: '400000' }])).toBe('1000000');
    expect(totalDbtMinor([])).toBe('0');
  });
});
