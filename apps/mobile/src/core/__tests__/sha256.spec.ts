// Unit tests for the pure SHA-256 against the FIPS 180-4 / NIST known-answer vectors. This is the integrity hash
// sent to the media confirm step, so correctness is non-negotiable.
import { sha256Hex } from '../util/sha256';

const enc = (s: string) => new TextEncoder().encode(s);

describe('sha256Hex', () => {
  it('hashes the empty input', () => {
    expect(sha256Hex(new Uint8Array(0))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('hashes "abc"', () => {
    expect(sha256Hex(enc('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('hashes the 448-bit multi-block vector', () => {
    expect(sha256Hex(enc('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')))
      .toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });
  it('hashes a longer string that crosses block padding', () => {
    expect(sha256Hex(enc('The quick brown fox jumps over the lazy dog')))
      .toBe('d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
  });
  it('is deterministic', () => {
    expect(sha256Hex(enc('krishi'))).toBe(sha256Hex(enc('krishi')));
  });
});
