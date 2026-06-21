# apps/ai-services/src/price_bands/router.py · POST /v1/price-bands — compute a fair-price band from recent modal
# observations. Service-to-service authed; money in/out as STRING minor units (Law 2). Records the inference
# (pointers only) + flags for review below the model's confidence threshold. NEVER sets a price — advisory only;
# the catalogue/market-intel module decides what to do with the band (Law 11).
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..common.auth import CallerContext
from ..common.http import require_caller
from ..common.inference_logger import InferenceRecord
from ..common.model_registry import needs_review
from .features import parse_minor
from .model import baseline_band, NoPriceDataError, InvalidBandError

router = APIRouter(prefix="/v1/price-bands", tags=["price-bands"])

_MODEL_CODE = "price_band"


class PriceBandRequest(BaseModel):
    model_config = {"extra": "forbid"}                 # reject unknown keys (no mass-assignment)
    product_id: str = Field(min_length=1, max_length=64)
    region_id: str = Field(min_length=1, max_length=64)
    grade_option_id: str | None = Field(default=None, max_length=64)
    target_date: str = Field(min_length=4, max_length=10)
    modals_minor: list[str] = Field(min_length=1, max_length=5000)


class PriceBandResponse(BaseModel):
    band: dict
    needs_review: bool


@router.post("", response_model=PriceBandResponse)
async def compute_band(body: PriceBandRequest, request: Request, caller: CallerContext = Depends(require_caller)) -> PriceBandResponse:
    state = request.app.state.app
    sample = parse_minor(body.modals_minor)
    model = await state.registry.active(_MODEL_CODE)
    try:
        band = baseline_band(sample)
    except (NoPriceDataError, InvalidBandError) as e:
        # not enough/!valid data is a client condition, not a 500 — return an explicit, typed failure
        state.metrics.inc(f"ai_price_band_reject_total{{code=\"{getattr(e, 'code', 'ERR')}\"}}")
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail=getattr(e, "code", "INVALID")) from e

    review = needs_review(band.confidence, model.confidence_threshold)
    state.metrics.inc("ai_price_band_total")
    await _safe_record(state, caller, model, body, band, review)
    return PriceBandResponse(band=band.as_strings(), needs_review=review)


async def _safe_record(state, caller, model, body, band, review) -> None:
    """Best-effort inference logging — a log outage must not fail the inference response (Law 12)."""
    try:
        await state.logger.record(InferenceRecord(
            tenant_id=caller.tenant_id,
            model_id=model.model_id,
            subject_type="price_band",
            subject_id=body.product_id,
            input_ref={"product_id": body.product_id, "region_id": body.region_id,
                       "grade_option_id": body.grade_option_id, "target_date": body.target_date,
                       "sample_size": band.sample_size},
            output={**band.as_strings(), "needs_review": review},
            confidence=band.confidence,
        ))
    except Exception:  # noqa: BLE001
        state.metrics.inc("ai_inference_log_fail_total")
