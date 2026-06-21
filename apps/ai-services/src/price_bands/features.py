# apps/ai-services/src/price_bands/features.py · turns the request's raw modal observations into the clean int
# minor-unit sample the model consumes. Inputs arrive as STRING minor units (Law 2 on the wire); we parse to int
# (arbitrary precision), drop anything malformed/negative, and bound the sample size (anti-DoS). Pure, stdlib-only.
from __future__ import annotations

import re

_INT_RE = re.compile(r"^\d{1,19}$")
_MAX_SAMPLE = 5000


def parse_minor(values: list[str] | None) -> list[int]:
    """Parse a list of string minor-unit amounts to int, dropping malformed/negative entries. Bounded length."""
    out: list[int] = []
    if not values:
        return out
    for v in values[:_MAX_SAMPLE]:
        if isinstance(v, int) and not isinstance(v, bool) and v >= 0:
            out.append(v)
        elif isinstance(v, str) and _INT_RE.match(v):
            out.append(int(v))
    return out
