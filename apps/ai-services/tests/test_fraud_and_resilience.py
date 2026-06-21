"""Fraud scoring rules (bigint minor units, explainable, advisory) + the circuit-breaker state machine."""
from src.fraud_signals.rules import score, FraudFeature, DEFAULT_THRESHOLDS, parse_minor
from src.fraud_signals.graph_features import feature_from_payload
from src.common.resilience import CircuitBreaker, BreakerConfig, backoff_ms


def test_parse_minor_int_units():
    assert parse_minor("250000") == 250000
    assert parse_minor("1.5") == 0 and parse_minor(-5) == 0


def test_normal_actor_not_flagged():
    a = score(FraudFeature())
    assert a.score == 0 and not a.flagged


def test_new_account_high_value_flags():
    a = score(FraudFeature(amount_minor=DEFAULT_THRESHOLDS.high_value_minor, account_age_days=0))
    assert "new_account_high_value" in a.reasons and a.flagged


def test_score_clamped_0_100():
    a = score(FraudFeature(amount_minor=10_000_00, orders_in_window=99, failed_payments_in_window=99,
                           account_age_days=0, distinct_devices_in_window=99, distinct_ips_in_window=99,
                           chargebacks_lifetime=3))
    assert 0 <= a.score <= 100 and a.flagged


def test_feature_from_payload_coerces():
    f = feature_from_payload({"amount_minor": "250000", "orders_in_window": 12, "account_age_days": -1})
    assert f.amount_minor == 250000 and f.orders_in_window == 12 and f.account_age_days == 365


def test_circuit_breaker_opens_and_recovers():
    t = [0]
    cb = CircuitBreaker(BreakerConfig(failure_threshold=3, reset_ms=1000, half_open_max=1), now_ms=lambda: t[0])
    assert cb.allow()
    for _ in range(3):
        cb.on_failure()
    assert cb.state == "open" and not cb.allow(0)        # tripped, still within reset window
    t[0] = 1000
    assert cb.allow(1000) and cb.state == "half_open"    # reset window elapsed → probe
    cb.on_success()
    assert cb.state == "closed"


def test_backoff_jittered_and_capped():
    assert backoff_ms(1, 100, 1000, rand=lambda: 0.999) < 100
    assert backoff_ms(50, 100, 1000, rand=lambda: 0.999) < 1000
    assert backoff_ms(1, 100, 1000, rand=lambda: 0.0) == 0
