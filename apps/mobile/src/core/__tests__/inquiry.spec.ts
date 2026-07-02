// Unit tests for the PURE buyer inquiry helpers (features/buyer/inquiry). No React/native deps.
import { INQUIRY_TEMPLATE_KEYS, MAX_INQUIRY_LEN, inquiryCharCount, isSendableInquiry } from '../../features/buyer/inquiry';

describe('inquiry compose (screen 97)', () => {
  it('exposes the five quick-template keys, in order', () => {
    expect(INQUIRY_TEMPLATE_KEYS).toEqual(['available', 'photos', 'moisture', 'delivery', 'negotiate']);
    expect(MAX_INQUIRY_LEN).toBe(500);
  });
  it('counts characters unicode-safely', () => {
    expect(inquiryCharCount('')).toBe(0);
    expect(inquiryCharCount('hello')).toBe(5);
    expect(inquiryCharCount('नमस्ते')).toBe(6);
  });
  it('is sendable only with non-blank text within the cap', () => {
    expect(isSendableInquiry('')).toBe(false);
    expect(isSendableInquiry('   ')).toBe(false);
    expect(isSendableInquiry('Is this available?')).toBe(true);
    expect(isSendableInquiry('x'.repeat(500))).toBe(true);
    expect(isSendableInquiry('x'.repeat(501))).toBe(false);
  });
});
