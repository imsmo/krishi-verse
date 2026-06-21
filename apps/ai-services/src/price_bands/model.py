# apps/ai-services/src/price_bands/model.py · the fair-price band model. P10/P50/P90 in MINOR UNITS as Python
# int (arbitrary precision — the bigint analogue; NEVER float — Law 2), via the nearest-rank percentile, exactly
# mirroring apps/api market-intel's baseline-v1 so the two agree. Pure + stdlib-only + unit-tested. confidence
# scales with sample size (capped). Output ints are serialized as STRINGS at the router edge.
from __future__ import annotations

from dataclasses import dataclass


class NoPriceDataError(ValueError):
    code = "NO_PRICE_DATA"


class InvalidBandError(ValueError):
    code = "INVALID_BAND"


def percentile(sorted_asc: list[int], p: int) -> int:
    """Nearest-rank percentile (1..100) on an ascending int sample. Float-free, deterministic."""
    n = len(sorted_asc)
    if n == 0:
        raise NoPriceDataError("empty sample")
    import math

    rank = math.ceil((p / 100) * n)              # 1-based; the only non-int, used for an index only
    idx = min(max(rank, 1), n) - 1
    return sorted_asc[idx]


@dataclass(frozen=True)
class PriceBand:
    p10_minor: int
    p50_minor: int
    p90_minor: int
    confidence: float
    model_version: str
    sample_size: int

    def as_strings(self) -> dict[str, object]:
        # money crosses the wire as STRING minor units (Law 2)
        return {
            "p10_minor": str(self.p10_minor),
            "p50_minor": str(self.p50_minor),
            "p90_minor": str(self.p90_minor),
            "confidence": self.confidence,
            "model_version": self.model_version,
            "sample_size": self.sample_size,
        }


_MIN_SAMPLE = 3


def baseline_band(modals_minor: list[int]) -> PriceBand:
    """Band from recent modal observations (need >=3). Rejects negative/non-int values (fail-closed)."""
    if len(modals_minor) < _MIN_SAMPLE:
        raise NoPriceDataError(f"need >= {_MIN_SAMPLE} observations")
    for m in modals_minor:
        if not isinstance(m, int) or isinstance(m, bool) or m < 0:
            raise InvalidBandError("observations must be non-negative integer minor units")
    sorted_asc = sorted(modals_minor)
    p10, p50, p90 = percentile(sorted_asc, 10), percentile(sorted_asc, 50), percentile(sorted_asc, 90)
    if not (p10 <= p50 <= p90):
        raise InvalidBandError("band must satisfy p10 <= p50 <= p90")
    confidence = min(0.9, 0.4 + 0.05 * len(sorted_asc))
    confidence = round(confidence * 10000) / 10000
    return PriceBand(p10, p50, p90, confidence, "baseline-v1", len(sorted_asc))
