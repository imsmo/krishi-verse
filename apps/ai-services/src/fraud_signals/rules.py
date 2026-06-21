# apps/ai-services/src/fraud_signals/rules.py · pure fraud scoring (richer than the stream-processor's inline
# rules — this is the model tier the feature-store feeds). Deterministic + explainable: each fired rule adds a
# weighted, reasoned contribution; the total clamps to 0..100. Money is int MINOR units (Law 2 — parsed from a
# string, never floated). A flag is ADVISORY only — it routes to the human review queue and never auto-blocks an
# account or moves money (Law 11). Unit-tested.
from __future__ import annotations

import re
from dataclasses import dataclass, field

_INT_RE = re.compile(r"^\d{1,19}$")


def parse_minor(v: object) -> int:
    if isinstance(v, int) and not isinstance(v, bool) and v >= 0:
        return v
    if isinstance(v, str) and _INT_RE.match(v):
        return int(v)
    return 0


@dataclass(frozen=True)
class FraudFeature:
    amount_minor: int = 0
    orders_in_window: int = 0
    failed_payments_in_window: int = 0
    account_age_days: int = 365
    distinct_devices_in_window: int = 1
    distinct_ips_in_window: int = 1
    chargebacks_lifetime: int = 0


@dataclass(frozen=True)
class Thresholds:
    high_value_minor: int = 5_000_00
    velocity_count: int = 10
    failed_payment_count: int = 3
    new_account_days: int = 2
    max_devices: int = 4
    max_ips: int = 5
    flag_at: int = 60


DEFAULT_THRESHOLDS = Thresholds()


@dataclass(frozen=True)
class Assessment:
    score: int
    reasons: list[str] = field(default_factory=list)
    flagged: bool = False


def score(f: FraudFeature, t: Thresholds = DEFAULT_THRESHOLDS) -> Assessment:
    reasons: list[str] = []
    s = 0
    if f.amount_minor >= t.high_value_minor:
        s += 30; reasons.append("high_value_transaction")
    if f.orders_in_window >= t.velocity_count:
        s += 25; reasons.append("order_velocity")
    if f.failed_payments_in_window >= t.failed_payment_count:
        s += 20; reasons.append("repeated_payment_failures")
    if f.account_age_days < t.new_account_days:
        s += 15; reasons.append("new_account")
    if f.distinct_devices_in_window > t.max_devices:
        s += 15; reasons.append("many_devices")
    if f.distinct_ips_in_window > t.max_ips:
        s += 10; reasons.append("many_ips")
    if f.chargebacks_lifetime > 0:
        s += 20; reasons.append("prior_chargebacks")
    if f.account_age_days < t.new_account_days and f.amount_minor >= t.high_value_minor:
        s += 15; reasons.append("new_account_high_value")
    s = max(0, min(100, s))
    return Assessment(score=s, reasons=reasons, flagged=s >= t.flag_at)
