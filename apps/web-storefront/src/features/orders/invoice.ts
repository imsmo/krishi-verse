// apps/web-storefront/src/features/orders/invoice.ts · PURE invoice-download helpers (no React/IO) → unit-tested.
// The presigned URL + readiness come from the server (payments.invoices.downloadUrl); these helpers only derive a
// safe, human-friendly download filename. No money, no fabrication.

/** A safe `<a download>` filename for an invoice (e.g. "invoice-INV2026-000123.pdf"). Strips anything that isn't
 *  alphanumeric/dash/underscore so a hostile invoice_no can't smuggle a path or header into the download attr. */
export function invoiceFileName(invoiceNo: string | null | undefined): string {
  const raw = typeof invoiceNo === 'string' ? invoiceNo.trim() : '';
  const safe = raw.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
  return safe.length > 0 ? `invoice-${safe}.pdf` : 'invoice.pdf';
}
