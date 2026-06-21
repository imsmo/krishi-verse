"""Security core: fail-closed config, constant-time s2s auth, PII redaction / pointer-only input_ref."""
from src.common.config import load_settings
from src.common.auth import verify_secret, parse_caller
from src.common.redact import safe_input_ref, scrub, mask_value
from src.common.model_registry import needs_review

STRONG = "x" * 40


def test_config_fail_closed_in_prod():
    try:
        load_settings({"APP_ENV": "production", "API_SHARED_SECRET": "dev-weak", "INFERENCE_LOG_DB_URL": "postgres://x"})
        assert False, "expected refusal on weak secret"
    except RuntimeError as e:
        assert "API_SHARED_SECRET" in str(e)


def test_config_ok_with_strong_secret():
    s = load_settings({"APP_ENV": "production", "API_SHARED_SECRET": STRONG, "INFERENCE_LOG_DB_URL": "postgres://x"})
    assert s.prod and not s.llm_enabled


def test_config_dev_is_lenient():
    s = load_settings({"APP_ENV": "development"})
    assert not s.prod


def test_verify_secret_constant_time_and_reject():
    assert verify_secret(f"Bearer {STRONG}", STRONG) is True
    assert verify_secret(STRONG, STRONG) is True
    assert verify_secret("Bearer wrong", STRONG) is False
    assert verify_secret(None, STRONG) is False
    assert verify_secret("Bearer x", "") is False


def test_parse_caller_validates_ids():
    c = parse_caller("11111111-1111-1111-1111-111111111111", "req_1", "api")
    assert c.tenant_id and c.request_id == "req_1" and c.caller == "api"
    bad = parse_caller("not a uuid!!", "bad id!", "BAD CALLER")
    assert bad.tenant_id is None and bad.request_id == "no-req-id" and bad.caller == "unknown"


def test_safe_input_ref_keeps_only_pointers():
    ref = {"media_id": "m1", "region_id": "r1", "phone": "9800000000", "transcript": "raw words", "extra": "drop"}
    out = safe_input_ref(ref)
    assert out == {"media_id": "m1", "region_id": "r1"}
    assert "phone" not in out and "transcript" not in out


def test_scrub_masks_pii_and_drops_denied_keys():
    scrubbed = scrub({"phone": "9800000000", "note": "call 9811111111 or x@y.com", "n": 5})
    assert "phone" not in scrubbed                       # denylisted key dropped
    assert "9811111111" not in scrubbed["note"] and "x@y.com" not in scrubbed["note"]
    assert scrubbed["n"] == 5


def test_mask_value_handles_pan_and_aadhaar():
    assert "ABCDE1234F" not in mask_value("pan ABCDE1234F")
    assert "1234 5678 9012" not in mask_value("uid 1234 5678 9012")


def test_needs_review_fail_closed_for_unregistered_model():
    assert needs_review(0.99, 0.0) is True               # threshold 0 (unregistered) ⇒ always review
    assert needs_review(0.95, 0.8) is False
    assert needs_review(0.5, 0.8) is True
