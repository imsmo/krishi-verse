// apps/mobile/src/features/buyer/inquiry.ts · PURE helpers for the buyer "Send Inquiry" compose (screen 97). No
// React/native imports → unit-tested. An inquiry is the first message of a direct conversation with the seller
// about a listing; these helpers own the quick-template key list + the message-length rules (mirrors the server's
// message body cap). The server re-validates; this is UX only.
export const INQUIRY_TEMPLATE_KEYS = ['available', 'photos', 'moisture', 'delivery', 'negotiate'] as const;
export type InquiryTemplateKey = (typeof INQUIRY_TEMPLATE_KEYS)[number];

/** Message body cap shown as "N / 500" and enforced client-side for UX (the server is the authority). */
export const MAX_INQUIRY_LEN = 500;

/** Unicode-safe character count (code points, not UTF-16 units) so Devanagari/Gujarati + emoji count as the user
 * sees them. Pure. */
export function inquiryCharCount(text: string): number {
  return Array.from(text ?? '').length;
}

/** Sendable only when there's non-blank text within the cap. Pure — drives the Send button's enabled state. */
export function isSendableInquiry(text: string): boolean {
  const n = inquiryCharCount((text ?? '').trim());
  return n >= 1 && inquiryCharCount(text ?? '') <= MAX_INQUIRY_LEN;
}
