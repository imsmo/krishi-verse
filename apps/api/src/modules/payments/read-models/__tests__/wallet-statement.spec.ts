// Pure tests for the P0-3 wallet statement formatters (float-free money + RFC-4180 CSV quoting).
import { formatMinorPlain, csvField, toCsv, statementPdfLines } from '../wallet-statement';

const row = (over: Partial<any> = {}): any => ({
  entryId: '1', txnId: 't1', txnType: 'settlement', accountCode: 'main',
  amountMinor: '12345', balanceAfterMinor: '12345', currencyCode: 'INR',
  referenceType: 'order', referenceId: 'o1', description: 'Sale', createdAt: '2026-01-15T10:00:00.000Z', ...over,
});

describe('formatMinorPlain (float-free minor→major)', () => {
  it('formats positive/negative/zero/small correctly', () => {
    expect(formatMinorPlain('12345')).toBe('123.45');
    expect(formatMinorPlain('-12345')).toBe('-123.45');
    expect(formatMinorPlain('0')).toBe('0.00');
    expect(formatMinorPlain('5')).toBe('0.05');
    expect(formatMinorPlain('100')).toBe('1.00');
  });
  it('never uses floats — a huge bigint keeps every digit', () => {
    expect(formatMinorPlain('900719925474099100')).toBe('9007199254740991.00');
  });
  it('degrades a bad value to 0', () => { expect(formatMinorPlain('abc')).toBe('0'); });
});

describe('csvField (RFC-4180 quoting)', () => {
  it('quotes commas/quotes/newlines and doubles inner quotes', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
    expect(csvField(null)).toBe('');
  });
});

describe('toCsv', () => {
  it('emits a header + one CRLF-terminated row per entry with decimal amounts', () => {
    const csv = toCsv([row(), row({ amountMinor: '-500', description: 'Fee, net' })]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Date,Type,Account,Amount,BalanceAfter,Currency,Reference,Description');
    expect(lines[1]).toContain('123.45');
    expect(lines[1]).toContain('order:o1');
    expect(lines[2]).toContain('-5.00');
    expect(lines[2]).toContain('"Fee, net"'); // comma-safe quoting
  });
});

describe('statementPdfLines', () => {
  it('accumulates credited/debited float-free', () => {
    const lines = statementPdfLines([row({ amountMinor: '10000' }), row({ amountMinor: '-4000' })],
      { fromIso: '2026-01-01T00:00:00Z', toIso: '2026-02-01T00:00:00Z', currencyCode: 'INR' });
    const joined = lines.join('\n');
    expect(joined).toContain('Total credited : INR 100.00');
    expect(joined).toContain('Total debited  : INR 40.00');
  });
  it('handles an empty period without crashing', () => {
    const lines = statementPdfLines([], { fromIso: '2026-01-01T00:00:00Z', toIso: '2026-02-01T00:00:00Z', currencyCode: 'INR' });
    expect(lines.join('\n')).toContain('(no wallet activity in this period)');
  });
});
