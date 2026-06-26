# apps/ai-services/src/doc_extraction/confidence.py · pure confidence model for document→listing extraction.
# There is no acoustic/OCR-confidence signal flowing in (the perception step is upstream), so confidence is the
# COMPLETENESS of the core commerce fields the model managed to extract. Low confidence → the caller shows a
# confirm/edit screen and routes to manual review (Law 11: the ambassador ALWAYS reviews + confirms before the
# consent-gated on-behalf create; the model never auto-submits). Pure + unit-tested.
from __future__ import annotations

# Reuse the canonical completeness weights from the voice path (one source of truth).
from ..voice_extraction.confidence import completeness


def overall_confidence(extracted: dict[str, object]) -> float:
    """Document extraction confidence = field completeness, clamped to 0..1. No perception-confidence to blend."""
    return round(max(0.0, min(1.0, completeness(extracted))), 4)
