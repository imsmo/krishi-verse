# apps/ai-services/src/doc_extraction/prompts.py · the LLM prompt that turns a farmer's DOCUMENT text (already
# OCR'd / typed upstream — e.g. a mandi receipt, a produce note, a scheme form) into a STRUCTURED draft listing.
# Pure string building — no I/O. Same allowed fields + STRICT-JSON discipline as the voice path (one canonical
# listing draft shape across the AI prefill surfaces). The model must leave a field null when unsure (low
# confidence surfaces as missing data, never a hallucinated value). Prices in MINOR UNITS as a string (Law 2).
# The doc text is the only free text we send the provider; it is NEVER persisted (only the structured output +
# pointers are logged to ai_inferences).
from __future__ import annotations

# Reuse the canonical listing-draft field set from the voice path (one source of truth for the draft shape).
from ..voice_extraction.prompts import ALLOWED_FIELDS  # noqa: F401  (re-exported for callers/tests)

DOC_TYPES = ("listing", "scheme")

SYSTEM_PROMPT = (
    "You read text extracted from an Indian farmer's paper document (a produce note, mandi receipt, or form) and "
    "convert it into a structured produce listing. Return STRICT JSON only, with exactly these keys: "
    "crop_name (string|null), quantity (number|null), unit (one of kg|quintal|tonne|dozen|piece|null), "
    "price_minor (string of integer paise|null), is_organic (boolean|null), grade (string|null). "
    "Use null for anything not clearly present in the document — never guess or infer. "
    "Do not include any other keys, commentary, or PII (names, phone, Aadhaar, account numbers)."
)


def build_user_prompt(doc_text: str, locale: str, doc_type: str) -> str:
    # bound the doc text defensively; it is transient and never stored.
    t = (doc_text or "").strip()[:4000]
    loc = locale if locale in ("hi", "en", "gu") else "hi"
    dt = doc_type if doc_type in DOC_TYPES else "listing"
    return f"locale={loc}\ndoc_type={dt}\ndocument_text:\n{t}\n\nReturn the JSON now."
