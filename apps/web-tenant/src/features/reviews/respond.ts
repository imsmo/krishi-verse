// apps/web-tenant/src/features/reviews/respond.ts · PURE validation for a seller's review response (no React/IO)
// → unit-tested. Mirrors the API DTO (1–4000 chars after trim) so an obviously-bad response never round-trips.
export type ResponseValidation = { ok: true; value: string } | { ok: false; error: 'empty' | 'too_long' };

export function validateReviewResponse(raw: string | null | undefined): ResponseValidation {
  const text = (typeof raw === 'string' ? raw : '').trim();
  if (text.length === 0) return { ok: false, error: 'empty' };
  if (text.length > 4000) return { ok: false, error: 'too_long' };
  return { ok: true, value: text };
}
