// core/media/__tests__/pdf-and-exif.spec.ts · PDF writer + EXIF stripper (pure, no codec/lib).
import { renderTextPdf, formatMinor } from '../pdf/pdf-writer';
import { stripImageMetadata } from '../image/exif-stripper';

describe('renderTextPdf', () => {
  it('produces a structurally valid single-page PDF containing the text', () => {
    const pdf = renderTextPdf('Settlement Statement STMT-2026-04-000001', ['Net payable   : INR 9,532.50']);
    const s = pdf.toString('latin1');
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(s).toContain('/Type/Catalog');
    expect(s).toContain('xref');
    expect(s).toContain('/Root 1 0 R');
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(s).toContain('Settlement Statement STMT-2026-04-000001');
    expect(s).toContain('Net payable   : INR 9,532.50');
    // the Content stream /Length matches the actual stream bytes
    const m = s.match(/<<\/Length (\d+)>>\nstream\n([\s\S]*?)\nendstream/);
    expect(m).toBeTruthy();
    expect(Buffer.byteLength(m![2], 'latin1')).toBe(Number(m![1]));
  });

  it('paginates long documents (Count > 1)', () => {
    const lines = Array.from({ length: 120 }, (_, i) => `line ${i}`);
    const s = renderTextPdf('Big', lines).toString('latin1');
    const count = Number(s.match(/\/Count (\d+)/)![1]);
    expect(count).toBeGreaterThan(1);
  });

  it('escapes PDF-special characters and drops non-WinAnsi', () => {
    const s = renderTextPdf('T', ['a (b) \\c ₹100']).toString('latin1');
    expect(s).toContain('a \\(b\\) \\\\c ?100');   // ( ) \ escaped; ₹ → ?
  });

  it('formatMinor groups and places the decimal', () => {
    expect(formatMinor('9532550')).toBe('95,325.50');
    expect(formatMinor('5')).toBe('0.05');
    expect(formatMinor('100000')).toBe('1,000.00');
  });
});

describe('stripImageMetadata — JPEG', () => {
  // SOI, APP1(EXIF "Exif\0\0"+GPS-ish), DQT(minimal), SOS + entropy data, EOI
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, 0x0a]), Buffer.from('Exif\0\0GPS')]);
  const dqt = Buffer.from([0xff, 0xdb, 0x00, 0x04, 0x11, 0x22]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x03, 0x01, 0xAA, 0xBB, 0xff, 0xd9]);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), app1, dqt, sos]);

  it('removes the APP1/EXIF segment but preserves DQT + image data', () => {
    const { data, stripped } = stripImageMetadata(jpeg, 'image/jpeg');
    expect(stripped).toBe(true);
    expect(data.includes(Buffer.from('Exif\0\0GPS'))).toBe(false);   // EXIF gone
    expect(data.includes(dqt)).toBe(true);                           // quant table kept
    expect(data.subarray(-9).equals(sos)).toBe(true);                // SOS + entropy data intact
    expect(data.readUInt16BE(0)).toBe(0xffd8);                       // still a JPEG
  });

  it('is idempotent (a clean JPEG strips to itself)', () => {
    const once = stripImageMetadata(jpeg, 'image/jpeg').data;
    const twice = stripImageMetadata(once, 'image/jpeg');
    expect(twice.stripped).toBe(false);
    expect(twice.data.equals(once)).toBe(true);
  });
});

describe('stripImageMetadata — PNG', () => {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type: string, data: Buffer) => Buffer.concat([(() => { const b = Buffer.alloc(4); b.writeUInt32BE(data.length); return b; })(), Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
  const png = Buffer.concat([sig, chunk('IHDR', Buffer.alloc(13)), chunk('eXIf', Buffer.from('GPSDATA')), chunk('IDAT', Buffer.from('pixels')), chunk('IEND', Buffer.alloc(0))]);

  it('drops eXIf/text chunks, keeps IHDR/IDAT/IEND', () => {
    const { data, stripped } = stripImageMetadata(png, 'image/png');
    expect(stripped).toBe(true);
    expect(data.includes(Buffer.from('GPSDATA'))).toBe(false);
    expect(data.includes(Buffer.from('IDAT'))).toBe(true);
    expect(data.includes(Buffer.from('IEND'))).toBe(true);
    expect(data.subarray(0, 8).equals(sig)).toBe(true);
  });

  it('leaves unknown formats untouched', () => {
    const webp = Buffer.from('RIFF....WEBP....');
    expect(stripImageMetadata(webp, 'image/webp').stripped).toBe(false);
  });
});
