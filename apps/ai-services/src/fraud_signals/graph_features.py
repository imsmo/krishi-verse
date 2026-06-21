# apps/ai-services/src/fraud_signals/graph_features.py · pure derivation of simple graph/velocity features from
# the aggregates the caller (feature-store / stream-processor) supplies. We do NOT walk the full identity graph
# here (that's the feature-store's batch job); we normalise the provided edge counts into the FraudFeature the
# rules consume. Pure, stdlib-only. NO PII — only counts/ids-as-counts.
from __future__ import annotations

from .rules import FraudFeature, parse_minor


def feature_from_payload(p: dict[str, object]) -> FraudFeature:
    """Build a FraudFeature from a request payload, coercing/bounding every field (fail safe on missing data)."""
    def i(key: str, default: int = 0) -> int:
        v = p.get(key)
        return v if isinstance(v, int) and not isinstance(v, bool) and v >= 0 else default

    return FraudFeature(
        amount_minor=parse_minor(p.get("amount_minor") or p.get("total_minor")),
        orders_in_window=i("orders_in_window"),
        failed_payments_in_window=i("failed_payments_in_window"),
        account_age_days=i("account_age_days", 365),
        distinct_devices_in_window=i("distinct_devices_in_window", 1) or 1,
        distinct_ips_in_window=i("distinct_ips_in_window", 1) or 1,
        chargebacks_lifetime=i("chargebacks_lifetime"),
    )
