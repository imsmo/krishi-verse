# apps/ai-services/src/fraud_signals/router.py · POST /v1/fraud-signals — score an actor/transaction for risk.
# Returns an ADVISORY assessment (score + reasons + flagged). It NEVER blocks an account or moves money (Law 11);
# a flag routes to the ai-governance human review queue. Records the inference (pointers only). Service-to-service
# authed. Money in as STRING minor units (Law 2).
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..common.auth import CallerContext
from ..common.http import require_caller
from ..common.inference_logger import InferenceRecord
from .graph_features import feature_from_payload
from .rules import score

router = APIRouter(prefix="/v1/fraud-signals", tags=["fraud-signals"])
_MODEL_CODE = "fraud_score"


class FraudRequest(BaseModel):
    model_config = {"extra": "forbid"}
    subject_type: str = Field(min_length=1, max_length=40)     # 'order','payment','user'
    subject_id: str = Field(min_length=1, max_length=64)
    actor_user_id: str | None = Field(default=None, max_length=64)
    features: dict = Field(default_factory=dict)               # counts/amounts only (no PII)


class FraudResponse(BaseModel):
    score: int
    reasons: list[str]
    flagged: bool


@router.post("", response_model=FraudResponse)
async def assess(body: FraudRequest, request: Request, caller: CallerContext = Depends(require_caller)) -> FraudResponse:
    state = request.app.state.app
    model = await state.registry.active(_MODEL_CODE)
    feature = feature_from_payload(body.features)
    result = score(feature)
    state.metrics.inc("ai_fraud_total")
    if result.flagged:
        state.metrics.inc("ai_fraud_flagged_total")
    try:
        await state.logger.record(InferenceRecord(
            tenant_id=caller.tenant_id, model_id=model.model_id, subject_type=body.subject_type,
            subject_id=body.subject_id,
            input_ref={"subject_id": body.subject_id, "subject_type": body.subject_type},   # pointers only
            output={"score": result.score, "reasons": result.reasons, "flagged": result.flagged},
            confidence=result.score / 100.0,
        ))
    except Exception:  # noqa: BLE001
        state.metrics.inc("ai_inference_log_fail_total")
    return FraudResponse(score=result.score, reasons=result.reasons, flagged=result.flagged)
