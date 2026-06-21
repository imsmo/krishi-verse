"""Price-band model — the money-critical path. Float-free int minor units (Law 2), nearest-rank percentile
matching market-intel baseline-v1, band invariant p10<=p50<=p90, fail-closed on bad data."""
from src.price_bands.model import baseline_band, percentile, NoPriceDataError, InvalidBandError
from src.price_bands.features import parse_minor


def test_percentile_nearest_rank():
    s = [100, 200, 300, 400, 500]
    assert percentile(s, 10) == 100
    assert percentile(s, 50) == 300
    assert percentile(s, 90) == 500


def test_baseline_band_returns_int_minor_and_valid_band():
    band = baseline_band([100, 200, 300, 400, 500, 600])
    assert isinstance(band.p10_minor, int) and isinstance(band.p90_minor, int)
    assert band.p10_minor <= band.p50_minor <= band.p90_minor
    # serialized for the wire as STRINGS (Law 2)
    out = band.as_strings()
    assert out["p10_minor"] == str(band.p10_minor)
    assert isinstance(out["p50_minor"], str)
    assert 0.0 < out["confidence"] <= 0.9


def test_baseline_band_requires_min_sample():
    try:
        baseline_band([100, 200])
        assert False, "expected NoPriceDataError"
    except NoPriceDataError:
        pass


def test_baseline_band_rejects_negative_or_float():
    for bad in [[-1, 2, 3], [1.5, 2, 3]]:
        try:
            baseline_band(bad)  # type: ignore[arg-type]
            assert False, "expected InvalidBandError"
        except InvalidBandError:
            pass


def test_parse_minor_drops_malformed():
    assert parse_minor(["100", "250000", "x", "-5", "1.5"]) == [100, 250000]
    assert parse_minor(None) == []


def test_confidence_caps_at_0_9():
    band = baseline_band([10] * 50)
    assert band.confidence == 0.9
