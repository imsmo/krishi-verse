// Unit tests for the PURE wallet-ledger presenters (sign classification + total position; BigInt, never float).
import { ledgerTone, presentLedgerEntry, totalWalletMinor } from '../features/wallet/ledger';

describe('ledgerTone', () => {
  it('classifies credit / debit / zero from the signed minor amount', () => {
    expect(ledgerTone('150000')).toBe('credit');
    expect(ledgerTone('-150000')).toBe('debit');
    expect(ledgerTone('0')).toBe('zero');
  });
  it('handles huge values beyond Number range (BigInt, not float)', () => {
    expect(ledgerTone('9007199254740993')).toBe('credit');   // > Number.MAX_SAFE_INTEGER
    expect(ledgerTone('-9007199254740993')).toBe('debit');
  });
  it('degrades a non-numeric value to zero', () => {
    expect(ledgerTone('abc')).toBe('zero');
    expect(ledgerTone('')).toBe('zero');
  });
});

describe('presentLedgerEntry', () => {
  it('passes through the server signed amount + running balance and flags credit', () => {
    expect(presentLedgerEntry({ amountMinor: '5000', balanceAfterMinor: '125000' }))
      .toEqual({ isCredit: true, tone: 'credit', amountMinor: '5000', balanceAfterMinor: '125000' });
  });
  it('flags a debit (negative amount) and keeps the running balance', () => {
    expect(presentLedgerEntry({ amountMinor: '-2000', balanceAfterMinor: '123000' }))
      .toEqual({ isCredit: false, tone: 'debit', amountMinor: '-2000', balanceAfterMinor: '123000' });
  });
});

describe('totalWalletMinor', () => {
  it('adds available + held with BigInt', () => {
    expect(totalWalletMinor('100000', '25000')).toBe('125000');
    expect(totalWalletMinor('9007199254740993', '1')).toBe('9007199254740994');
  });
  it('treats a non-numeric component as zero (degrade-never-die)', () => {
    expect(totalWalletMinor('100000', 'x')).toBe('100000');
    expect(totalWalletMinor('y', 'z')).toBe('0');
  });
});
