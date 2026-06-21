# apps/ai-services/src/photo_grading/model.py · maps a CV model's raw class-probability vector to a produce GRADE
# (A/B/C/reject) + confidence. The probability vector comes from the per-crop CV model (a boundary that fetches
# the image + runs inference out of band — degrade-not-die: if it's unavailable the router returns needs_review
# at confidence 0). The PURE part here is the argmax→grade mapping + confidence, which is unit-tested. Grading is
# ADVISORY: it suggests a grade the seller/ops confirms; it never auto-changes a listing or price (Law 11).
from __future__ import annotations

from dataclasses import dataclass

GRADES = ("A", "B", "C", "reject")


class InvalidScoresError(ValueError):
    code = "INVALID_SCORES"


@dataclass(frozen=True)
class Grade:
    grade: str
    confidence: float
    scores: dict[str, float]


def grade_from_scores(scores: dict[str, float]) -> Grade:
    """Pick the highest-probability grade. Validates the vector covers the known grades and is a distribution-ish
    (each in [0,1]); confidence = the winning probability. Fail-closed on malformed input."""
    if not isinstance(scores, dict) or not scores:
        raise InvalidScoresError("empty scores")
    clean: dict[str, float] = {}
    for g in GRADES:
        v = scores.get(g)
        if not isinstance(v, (int, float)) or isinstance(v, bool) or v < 0 or v > 1:
            raise InvalidScoresError(f"score for {g} missing/out of range")
        clean[g] = float(v)
    winner = max(clean, key=lambda k: clean[k])
    return Grade(grade=winner, confidence=round(clean[winner], 4), scores=clean)
