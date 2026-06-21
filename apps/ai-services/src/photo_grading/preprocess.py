# apps/ai-services/src/photo_grading/preprocess.py · pure validation of the image METADATA a caller supplies for
# grading. The service is given a MEDIA POINTER (media_id) + basic metadata (dimensions, format, bytes) — never
# raw image bytes in the request (the model fetches from the object store out of band). We validate the metadata
# is gradeable (min resolution, allowed format, size cap) and FAIL CLOSED on anything off. Pure, stdlib-only.
from __future__ import annotations

from dataclasses import dataclass

_ALLOWED_FORMATS = {"jpeg", "jpg", "png", "webp"}
_MIN_DIM = 256
_MAX_BYTES = 12 * 1024 * 1024


class UngradeableImageError(ValueError):
    code = "UNGRADEABLE_IMAGE"


@dataclass(frozen=True)
class ImageMeta:
    media_id: str
    width: int
    height: int
    fmt: str
    size_bytes: int


def validate_image(meta: ImageMeta) -> None:
    """Reject images that can't be graded reliably (too small / wrong format / too large)."""
    if meta.fmt.lower() not in _ALLOWED_FORMATS:
        raise UngradeableImageError(f"unsupported format: {meta.fmt}")
    if meta.width < _MIN_DIM or meta.height < _MIN_DIM:
        raise UngradeableImageError("image below minimum resolution")
    if meta.size_bytes <= 0 or meta.size_bytes > _MAX_BYTES:
        raise UngradeableImageError("image size out of bounds")
