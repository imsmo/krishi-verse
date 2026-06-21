# apps/ai-services/src/voice_extraction/router.py · POST /v1/voice-extraction — transcript → structured draft
# listing. The transcript is transient (used for the LLM call, NEVER persisted); only the structured output +
# pointers are logged to ai_inferences. Degrades: if the LLM is unavailable/disabled, returns an empty draft at
# confidence 0 so the app falls back to manual entry. The farmer ALWAYS confirms before publish (Law 11).
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..common.auth import CallerContext
from ..common.http import require_caller
from ..common.inference_logger import InferenceRecord
from ..common.model_registry import needs_review
from ..common.resilience import run as resilient_run, CircuitOpenError
from .confidence import overall_confidence
from .extractor import parse_llm_json, call_llm
from .prompts import SYSTEM_PROMPT, build_user_prompt

router = APIRouter(prefix="/v1/voice-extraction", tags=["voice-extraction"])
_MODEL_CODE = "voice_listing_extract"


class VoiceRequest(BaseModel):
    model_config = {"extra": "forbid"}
    transcript: str = Field(min_length=1, max_length=2000)   # transient; never stored
    locale: str = Field(default="hi", pattern="^(hi|en|gu)$")
    stt_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    media_id: str | None = Field(default=None, max_length=64)   # pointer for the audit log


class VoiceResponse(BaseModel):
    draft: dict
    confidence: float
    needs_review: bool


@router.post("", response_model=VoiceResponse)
async def extract(body: VoiceRequest, request: Request, caller: CallerContext = Depends(require_caller)) -> VoiceResponse:
    state = request.app.state.app
    model = await state.registry.active(_MODEL_CODE)
    draft: dict = {}
    if state.settings.llm_enabled:
        try:
            text = await resilient_run(
                lambda: call_llm(SYSTEM_PROMPT, build_user_prompt(body.transcript, body.locale),
                                 api_key=state.settings.anthropic_api_key, timeout_ms=state.settings.http_timeout_ms),
                breaker=state.breakers["llm"], timeout_ms=state.settings.http_timeout_ms, retries=1,
            )
            draft = parse_llm_json(text)
        except (CircuitOpenError, Exception):  # noqa: BLE001 — degrade to manual entry, never raise
            state.metrics.inc("ai_voice_degraded_total")
            draft = parse_llm_json("")
    else:
        draft = parse_llm_json("")

    conf = overall_confidence(body.stt_confidence, draft) if state.settings.llm_enabled else 0.0
    review = needs_review(conf, model.confidence_threshold)
    state.metrics.inc("ai_voice_total")
    try:
        await state.logger.record(InferenceRecord(
            tenant_id=caller.tenant_id, model_id=model.model_id, subject_type="voice_listing",
            subject_id=body.media_id or caller.request_id,
            input_ref={"media_id": body.media_id, "locale": body.locale},   # NO transcript (pointers only)
            output={"draft": draft, "needs_review": review}, confidence=conf,
        ))
    except Exception:  # noqa: BLE001
        state.metrics.inc("ai_inference_log_fail_total")
    return VoiceResponse(draft=draft, confidence=conf, needs_review=review)
