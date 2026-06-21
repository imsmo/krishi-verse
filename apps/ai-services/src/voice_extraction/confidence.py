# apps/ai-services/src/voice_extraction/confidence.py · pure confidence model for voice→listing extraction.
# Overall confidence blends the STT acoustic confidence with how COMPLETE the extracted listing is (the core
# commerce fields present). Low confidence → the caller shows a confirm screen / routes to review (Law 11: the
# farmer always confirms before a listing publishes; the model never auto-publishes). Pure + unit-tested.
from __future__ import annotations

# fields that matter most for a usable listing, with weights summing to 1.0
_FIELD_WEIGHTS = {"crop_name": 0.4, "quantity": 0.25, "unit": 0.15, "price_minor": 0.2}


def completeness(extracted: dict[str, object]) -> float:
    score = 0.0
    for field, w in _FIELD_WEIGHTS.items():
        v = extracted.get(field)
        if v is not None and v != "":
            score += w
    return round(score, 4)


def overall_confidence(stt_confidence: float, extracted: dict[str, object]) -> float:
    """Blend STT confidence (clamped 0..1) with field completeness. Geometric-ish: both must be decent."""
    stt = max(0.0, min(1.0, stt_confidence))
    comp = completeness(extracted)
    blended = 0.5 * stt + 0.5 * comp
    return round(max(0.0, min(1.0, blended)), 4)
