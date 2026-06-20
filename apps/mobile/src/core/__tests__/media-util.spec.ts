// Unit tests for base64 decode + media mime mapping (the dependency-free parts of the media pipeline).
import { base64ToBytes, base64ByteLength } from '../util/base64';
import { sha256Hex } from '../util/sha256';
import { mediaKindForMime, isUploadableMime } from '../media/mime';

describe('base64ToBytes', () => {
  it('decodes "TWFu" → Man', () => {
    expect(Array.from(base64ToBytes('TWFu'))).toEqual([77, 97, 110]);
  });
  it('handles padding ("aGVsbG8=" → hello)', () => {
    expect(new TextDecoder().decode(base64ToBytes('aGVsbG8='))).toBe('hello');
  });
  it('ignores embedded whitespace/newlines', () => {
    expect(new TextDecoder().decode(base64ToBytes('aGVs\nbG8='))).toBe('hello');
  });
  it('reports byte length without full decode', () => {
    expect(base64ByteLength('aGVsbG8=')).toBe(5);
  });
  it('round-trips with sha256 (decoded bytes hash equals direct hash)', () => {
    const bytes = new TextEncoder().encode('integrity');
    const b64 = Buffer.from(bytes).toString('base64');
    expect(sha256Hex(base64ToBytes(b64))).toBe(sha256Hex(bytes));
  });
  it('throws on invalid characters', () => {
    expect(() => base64ToBytes('@@@@')).toThrow();
  });
});

describe('media mime mapping', () => {
  it('maps known types to MediaKind', () => {
    expect(mediaKindForMime('image/jpeg')).toBe('image');
    expect(mediaKindForMime('video/mp4')).toBe('video');
    expect(mediaKindForMime('audio/mpeg')).toBe('audio');
    expect(mediaKindForMime('application/pdf')).toBe('document');
  });
  it('rejects unsupported types', () => {
    expect(mediaKindForMime('application/x-msdownload')).toBeNull();
    expect(isUploadableMime('text/html')).toBe(false);
    expect(isUploadableMime('image/png')).toBe(true);
  });
});
