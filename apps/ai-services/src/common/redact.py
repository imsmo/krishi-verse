# apps/ai-services/src/common/redact.py · the "no PII in the audit log" backstop (guide §4). ai_inferences.input_ref
# is POINTERS ONLY (media id, listing id, region id, …) — NEVER raw audio/transcript/phone/Aadhaar/PAN. This module
# (a) validates that an input_ref carries only allow-listed pointer keys (rejecting anything else, fail-closed),
# and (b) deep-scrubs free-text/structured values for PII patterns before anything is logged. Pure, stdlib-only,
# unit-tested — it's the last line of defence if a caller ever passes through something sensitive.
from __future__ import annotations

import re
from typing import Any

# Allow-listed pointer keys permitted in input_ref. Everything else is dropped (fail-closed).
_ALLOWED_REF_KEYS = frozenset({
    "media_id", "image_id", "listing_id", "order_id", "auction_id", "product_id", "region_id",
    "grade_option_id", "subject_id", "subject_type", "target_date", "sample_size", "locale", "crop_id",
})

# Denylisted keys whose values are always dropped from any logged structure.
_DENY_KEY_RE = re.compile(r"(phone|mobile|email|aadhaar|pan|account|ifsc|otp|token|secret|password|name|address|transcript|audio)", re.I)

# Value patterns that look like PII → masked.
_PII_VALUE_RES = (
    re.compile(r"\b[6-9]\d{9}\b"),                                   # Indian mobile
    re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b"),                        # Aadhaar-like
    re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b"),                           # PAN
    re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),   # email
    re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\b"),                        # JWT-ish
)

_MAX_DEPTH = 6


def mask_value(s: str) -> str:
    out = s
    for rx in _PII_VALUE_RES:
        out = rx.sub("[redacted]", out)
    return out


def scrub(value: Any, _depth: int = 0) -> Any:
    """Deep-scrub a structure for logging: drop denylisted keys, mask PII-looking strings. Bounded depth."""
    if _depth >= _MAX_DEPTH:
        return "[truncated]"
    if isinstance(value, dict):
        return {k: scrub(v, _depth + 1) for k, v in value.items() if not _DENY_KEY_RE.search(str(k))}
    if isinstance(value, (list, tuple)):
        return [scrub(v, _depth + 1) for v in list(value)[:50]]
    if isinstance(value, str):
        return mask_value(value[:2000])
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    return mask_value(str(value)[:2000])


def safe_input_ref(ref: dict[str, Any] | None) -> dict[str, Any]:
    """Reduce an input_ref to ONLY allow-listed pointer keys with scalar pointer values. Anything not on the
    allow-list (or any nested/PII value) is dropped — so ai_inferences.input_ref can never hold raw PII."""
    if not isinstance(ref, dict):
        return {}
    out: dict[str, Any] = {}
    for k, v in ref.items():
        if k not in _ALLOWED_REF_KEYS:
            continue
        if isinstance(v, (str, int)) and not (isinstance(v, str) and any(rx.search(v) for rx in _PII_VALUE_RES)):
            out[k] = v if isinstance(v, int) else v[:128]
    return out
