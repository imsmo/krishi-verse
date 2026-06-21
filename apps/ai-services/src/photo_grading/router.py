# apps/ai-services/src/photo_grading/router.py · POST /v1/photo-grading — suggest a produce grade from an image
# pointer + its CV class-probabilities. Service-to-service authed. Validates the image metadata, maps scores →
# grade, records the inference (pointers only — media_id, never raw image), flags low confidence for review.
# Advisory only: never changes a listing/price (Law 11). Degrades if scores are absent (model unavailable).
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ..common.auth import CallerContext
from ..common.http import require_caller
from ..common.inference_logger import InferenceRecord
from ..common.model_registry import needs_review
from .preprocess import ImageMeta, validate_image, UngradeableImageError
from .model import grade_from_scores, InvalidScoresError

router = APIRouter(prefix="/v1/photo-grading", tags=["photo-grading"])
_MODEL_CODE = "photo_grading"


class PhotoGradeRequest(BaseModel):
    model_config = {"extra": "forbid"}
    media_id: str = Field(min_length=1, max_length=64)
    width: int = Field(ge=1, le=20000)
    height: int = Field(ge=1, le=20000)
    fmt: str = Field(min_length=2, max_length=10)
    size_bytes: int = Field(ge=1)
    scores: dict[str, float] | None = None      # CV class-probabilities; absent → needs_review


class PhotoGradeResponse(BaseModel):
    grade: str | None
    confidence: float
    needs_review: bool


@router.post("", response_model=PhotoGradeResponse)
async def grade(body: PhotoGradeRequest, request: Request, caller: CallerContext = Depends(require_caller)) -> PhotoGradeResponse:
    state = request.app.state.app
    try:
        validate_image(ImageMeta(body.media_id, body.width, body.height, body.fmt, body.size_bytes))
    except UngradeableImageError as e:
        raise HTTPException(status_code=422, detail=getattr(e, "code", "UNGRADEABLE")) from e

    model = await state.registry.active(_MODEL_CODE)
    grade_val: str | None = None
    confidence = 0.0
    if body.scores is not None:
        try:
            g = grade_from_scores(body.scores)
            grade_val, confidence = g.grade, g.confidence
        except InvalidScoresError:
            state.metrics.inc("ai_photo_degraded_total")
    else:
        state.metrics.inc("ai_photo_degraded_total")           # model unavailable → review

    review = needs_review(confidence, model.confidence_threshold) or grade_val is None
    state.metrics.inc("ai_photo_total")
    try:
        await state.logger.record(InferenceRecord(
            tenant_id=caller.tenant_id, model_id=model.model_id, subject_type="photo_grade",
            subject_id=body.media_id,
            input_ref={"media_id": body.media_id},             # pointer only; never the image bytes
            output={"grade": grade_val, "needs_review": review}, confidence=confidence,
        ))
    except Exception:  # noqa: BLE001
        state.metrics.inc("ai_inference_log_fail_total")
    return PhotoGradeResponse(grade=grade_val, confidence=confidence, needs_review=review)
