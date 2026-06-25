// Unit tests for the PURE invoice-download filename helper. Proves a hostile invoice_no can't smuggle a path
// into the download attribute, and that blank input degrades to a safe default.
import { invoiceFileName } from '../features/orders/invoice';

describe('invoiceFileName', () => {
  it('builds invoice-<no>.pdf for a normal invoice number', () => {
    expect(invoiceFileName('INV2026-000123')).toBe('invoice-INV2026-000123.pdf');
  });
  it('strips path / unsafe chars (no traversal, no header smuggling)', () => {
    expect(invoiceFileName('../../etc/passwd')).toBe('invoice-etcpasswd.pdf');
    expect(invoiceFileName('INV 1/2\\3"x')).toBe('invoice-INV123x.pdf');
  });
  it('falls back to a safe default for blank / nullish / all-unsafe input', () => {
    expect(invoiceFileName(null)).toBe('invoice.pdf');
    expect(invoiceFileName(undefined)).toBe('invoice.pdf');
    expect(invoiceFileName('   ')).toBe('invoice.pdf');
    expect(invoiceFileName('/\\:*')).toBe('invoice.pdf');
  });
  it('caps very long numbers', () => {
    expect(invoiceFileName('A'.repeat(200))).toBe(`invoice-${'A'.repeat(60)}.pdf`);
  });
});
