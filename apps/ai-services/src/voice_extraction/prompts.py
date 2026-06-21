# apps/ai-services/src/voice_extraction/prompts.py · the LLM prompt that turns a vernacular speech transcript into
# a STRUCTURED draft listing (crop, quantity, unit, price). Pure string building — no I/O. The prompt instructs
# the model to return STRICT JSON with only the allowed fields and to leave a field null when unsure (so low
# confidence surfaces as missing data, not a hallucinated value). Prices are requested in MINOR UNITS as a string
# (Law 2). The transcript is the only free text we send the provider; it is NEVER persisted (only the structured
# output + pointers are logged).
from __future__ import annotations

ALLOWED_FIELDS = ("crop_name", "quantity", "unit", "price_minor", "is_organic", "grade")

SYSTEM_PROMPT = (
    "You convert an Indian farmer's spoken sentence (Hindi/English/Gujarati) into a structured produce listing. "
    "Return STRICT JSON only, with exactly these keys: crop_name (string|null), quantity (number|null), "
    "unit (one of kg|quintal|tonne|dozen|piece|null), price_minor (string of integer paise|null), "
    "is_organic (boolean|null), grade (string|null). Use null for anything not clearly stated — never guess. "
    "Do not include any other keys, commentary, or PII."
)


def build_user_prompt(transcript: str, locale: str) -> str:
    # bound the transcript length defensively; the transcript is transient and never stored
    t = (transcript or "").strip()[:2000]
    loc = locale if locale in ("hi", "en", "gu") else "hi"
    return f"locale={loc}\ntranscript:\n{t}\n\nReturn the JSON now."
