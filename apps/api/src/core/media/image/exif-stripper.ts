// core/media/image/exif-stripper.ts
// Strips privacy-sensitive metadata (EXIF GPS, XMP, comments) from JPEG/PNG by SEGMENT/CHUNK surgery
// — no image codec / native dependency, so it adds nothing to install and is fully unit-testable.
// It does NOT decode pixels (that needs a codec — thumbnail resize is deferred); it only removes
// metadata segments while preserving the image data verbatim. Unknown formats are returned untouched.
const JPEG_SOI = 0xffd8;
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface StripResult { data: Buffer; stripped: boolean; }

/** Remove EXIF/XMP (APP1) + comments (COM) from a JPEG, keeping JFIF(APP0)/ICC(APP2) and image data. */
function stripJpeg(buf: Buffer): StripResult {
  if (buf.length < 4 || buf.readUInt16BE(0) !== JPEG_SOI) return { data: buf, stripped: false };
  const out: Buffer[] = [buf.subarray(0, 2)];   // SOI
  let i = 2; let removed = false;
  while (i + 1 < buf.length) {
    if (buf[i] !== 0xff) { out.push(buf.subarray(i)); break; }     // not a marker → bail, copy rest
    const marker = buf[i + 1];
    if (marker === 0xda) { out.push(buf.subarray(i)); break; }     // SOS → image data to EOF, copy verbatim
    if (marker === 0xd9) { out.push(buf.subarray(i, i + 2)); break; } // EOI
    if (i + 3 >= buf.length) { out.push(buf.subarray(i)); break; }
    const len = buf.readUInt16BE(i + 2);                            // segment length incl. the 2 length bytes
    const segEnd = i + 2 + len;
    if (segEnd > buf.length) { out.push(buf.subarray(i)); break; }  // malformed → stop trimming
    if (marker === 0xe1 || marker === 0xfe || marker === 0xed) {    // APP1 (EXIF/XMP), COM, APP13 (IPTC) → drop
      removed = true;
    } else {
      out.push(buf.subarray(i, segEnd));
    }
    i = segEnd;
  }
  return { data: Buffer.concat(out), stripped: removed };
}

/** Remove ancillary metadata chunks (eXIf, tEXt, zTXt, iTXt) from a PNG; keep IHDR/PLTE/IDAT/IEND/etc. */
function stripPng(buf: Buffer): StripResult {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) return { data: buf, stripped: false };
  const DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt']);
  const out: Buffer[] = [buf.subarray(0, 8)];
  let i = 8; let removed = false;
  while (i + 8 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.subarray(i + 4, i + 8).toString('latin1');
    const chunkEnd = i + 12 + len;                                  // length(4)+type(4)+data(len)+crc(4)
    if (chunkEnd > buf.length) { out.push(buf.subarray(i)); break; }
    if (DROP.has(type)) removed = true; else out.push(buf.subarray(i, chunkEnd));
    i = chunkEnd;
    if (type === 'IEND') break;
  }
  return { data: Buffer.concat(out), stripped: removed };
}

/** Strip metadata based on MIME (or sniffed signature). Idempotent. */
export function stripImageMetadata(buf: Buffer, mime: string): StripResult {
  if (mime === 'image/jpeg' || (buf.length >= 2 && buf.readUInt16BE(0) === JPEG_SOI)) return stripJpeg(buf);
  if (mime === 'image/png' || (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIG))) return stripPng(buf);
  return { data: buf, stripped: false };   // webp/heic/etc. need a codec — left untouched (deferred)
}
