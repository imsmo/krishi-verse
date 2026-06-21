"""Photo grading: image-metadata validation (fail-closed) + scores->grade argmax mapping."""
from src.photo_grading.preprocess import ImageMeta, validate_image, UngradeableImageError
from src.photo_grading.model import grade_from_scores, InvalidScoresError


def test_validate_image_accepts_good_meta():
    validate_image(ImageMeta("m1", 1024, 768, "jpeg", 500_000))   # no raise


def test_validate_image_rejects_bad():
    for meta in [
        ImageMeta("m1", 100, 100, "jpeg", 1000),        # too small
        ImageMeta("m1", 1024, 768, "bmp", 1000),        # bad format
        ImageMeta("m1", 1024, 768, "jpeg", 0),          # zero bytes
        ImageMeta("m1", 1024, 768, "jpeg", 99_000_000), # too large
    ]:
        try:
            validate_image(meta)
            assert False, "expected UngradeableImageError"
        except UngradeableImageError:
            pass


def test_grade_argmax():
    g = grade_from_scores({"A": 0.7, "B": 0.2, "C": 0.05, "reject": 0.05})
    assert g.grade == "A" and g.confidence == 0.7


def test_grade_rejects_malformed_scores():
    for bad in [{}, {"A": 1.2, "B": 0, "C": 0, "reject": 0}, {"A": 0.5}]:
        try:
            grade_from_scores(bad)
            assert False, "expected InvalidScoresError"
        except InvalidScoresError:
            pass
