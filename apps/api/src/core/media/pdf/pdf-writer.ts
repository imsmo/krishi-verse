// core/media/pdf/pdf-writer.ts
// Minimal, self-contained PDF 1.4 generator (text-only, Helvetica) — NO external library, so it is
// deterministic and unit-testable, and adds no native/codec dependency. Sufficient for financial
// documents (settlement statements, GST invoices): a title + lines of text, paginated. Byte offsets
// for the xref are computed exactly. Text is WinAnsi (Helvetica) — callers avoid non-WinAnsi glyphs
// (e.g. use "INR" not the ₹ sign); see formatMinor().
const PAGE_W = 595, PAGE_H = 842, MARGIN_X = 50, TOP_Y = 800, LEADING = 16, LINES_PER_PAGE = 44;

/** Escape a PDF text-string literal: backslash and parentheses; drop control chars + non-WinAnsi. */
function escapePdf(s: string): string {
  return s.replace(/[\\()]/g, (c) => '\\' + c).replace(/[^\x20-\x7e]/g, '?');
}
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out.length ? out : [[]];
}

/** Render a title + body lines into a (possibly multi-page) PDF Buffer. */
export function renderTextPdf(title: string, lines: string[]): Buffer {
  const all = [title, '', ...lines];
  const pages = chunk(all, LINES_PER_PAGE);

  // object numbers: 1=Catalog, 2=Pages, 3=Font, then per page (pageObj, contentObj)
  const pageObjNums: number[] = []; const contentObjNums: number[] = [];
  let next = 4;
  for (let i = 0; i < pages.length; i++) { pageObjNums.push(next++); contentObjNums.push(next++); }
  const totalObjs = next - 1;

  const bodies = new Map<number, string>();
  bodies.set(1, `<</Type/Catalog/Pages 2 0 R>>`);
  bodies.set(2, `<</Type/Pages/Kids[${pageObjNums.map((x) => `${x} 0 R`).join(' ')}]/Count ${pages.length}>>`);
  bodies.set(3, `<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>`);
  pages.forEach((pl, i) => {
    bodies.set(pageObjNums[i], `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${PAGE_W} ${PAGE_H}]/Resources<</Font<</F1 3 0 R>>>>/Contents ${contentObjNums[i]} 0 R>>`);
    const stream = `BT /F1 11 Tf ${MARGIN_X} ${TOP_Y} Td ${LEADING} TL ${pl.map((t) => `(${escapePdf(t)}) Tj T*`).join(' ')} ET`;
    bodies.set(contentObjNums[i], `<</Length ${Buffer.byteLength(stream, 'latin1')}>>\nstream\n${stream}\nendstream`);
  });

  let body = '%PDF-1.4\n';
  const offsets = new Map<number, number>();
  for (let k = 1; k <= totalObjs; k++) {
    offsets.set(k, Buffer.byteLength(body, 'latin1'));
    body += `${k} 0 obj\n${bodies.get(k)}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
  for (let k = 1; k <= totalObjs; k++) body += `${String(offsets.get(k)).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<</Size ${totalObjs + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

/** bigint minor-unit string → grouped decimal (e.g. "953250" → "9,532.50"). No currency glyph. */
export function formatMinor(minor: string | bigint, fractionDigits = 2): string {
  const neg = String(minor).startsWith('-');
  const digits = String(minor).replace('-', '').padStart(fractionDigits + 1, '0');
  const whole = digits.slice(0, digits.length - fractionDigits) || '0';
  const frac = digits.slice(digits.length - fractionDigits);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${grouped}.${frac}`;
}
