"""Voice->listing extraction: never trust the model output (normalise/validate), confidence blend, price as
string minor units (Law 2)."""
from src.voice_extraction.extractor import normalise_listing, parse_llm_json
from src.voice_extraction.confidence import completeness, overall_confidence


def test_normalise_drops_unknown_keys_and_bad_types():
    out = normalise_listing({"crop_name": "Tomato", "quantity": 5, "unit": "kg", "price_minor": "2500",
                             "is_organic": True, "grade": "A", "evil": "DROP ME", "extra": 1})
    assert out == {"crop_name": "Tomato", "quantity": 5.0, "unit": "kg", "price_minor": "2500",
                   "is_organic": True, "grade": "A"}
    assert "evil" not in out


def test_normalise_rejects_bad_unit_and_negative_qty():
    out = normalise_listing({"crop_name": "X", "quantity": -2, "unit": "barrels", "price_minor": "-5"})
    assert out["quantity"] is None and out["unit"] is None and out["price_minor"] is None


def test_price_minor_stays_string():
    out = normalise_listing({"price_minor": 2500})
    assert out["price_minor"] == "2500" and isinstance(out["price_minor"], str)


def test_parse_llm_json_handles_fenced_and_garbage():
    assert parse_llm_json('```json\n{"crop_name":"Wheat"}\n```')["crop_name"] == "Wheat"
    assert parse_llm_json("not json")["crop_name"] is None         # degrade to empty draft


def test_completeness_and_confidence():
    full = {"crop_name": "T", "quantity": 5, "unit": "kg", "price_minor": "100"}
    assert completeness(full) == 1.0
    assert overall_confidence(1.0, full) == 1.0
    assert overall_confidence(0.0, {}) == 0.0
    mid = overall_confidence(1.0, {"crop_name": "T"})
    assert 0.0 < mid < 1.0
