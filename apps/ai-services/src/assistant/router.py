# apps/ai-services/src/assistant/router.py · POST /v1/assistant — the governed farmer-assistant inference.
# Service-to-service authed; advisory only (Law 11 — the api tier owns the conversation + the user-facing
# decision). Pipeline: screen (2nd-layer injection guard) → run the LLM under the "llm" breaker + timeout →
# record an ai_inference (pointers only, never the raw message) → return {reply, needs_review, confidence,
# citations, model_*}. No provider key (or breaker open / model error) ⇒ needs_review with NO fabricated text
# (Law 12). The api tier substitutes a safe message + applies its own threshold.
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..common.auth import CallerContext
from ..common.http import require_caller
from ..common.inference_logger import InferenceRecord
from ..common.model_registry import needs_review
from ..common import resilience
from .guardrails import screen_message
from .provider import build_provider, LlmResult

router = APIRouter(prefix="/v1/assistant", tags=["assistant"])

_MODEL_CODE = "farm_assistant"


class AssistantRequest(BaseModel):
    model_config = {"extra": "forbid"}                 # reject unknown keys (no mass-assignment)
    tenant_id: str | None = Field(default=None, max_length=64)
    message: str = Field(min_length=1, max_length=2000)
    language_code: str = Field(min_length=2, max_length=2)
    session_id: str | None = Field(default=None, max_length=64)
    context: dict[str, str] = Field(default_factory=dict)


class AssistantResponse(BaseModel):
    reply: str
    needs_review: bool
    confidence: float | None
    citations: list[dict]
    model_code: str
    model_id: str | None


@router.post("", response_model=AssistantResponse)
async def assistant(body: AssistantRequest, request: Request, caller: CallerContext = Depends(require_caller)) -> AssistantResponse:
    state = request.app.state.app
    model = await state.registry.active(_MODEL_CODE)

    ok, clean, reasons = screen_message(body.message)
    if not ok:
        state.metrics.inc('ai_assistant_blocked_total')
        await _safe_record(state, caller, model, body.language_code, status="blocked", confidence=None, reasons=reasons)
        return AssistantResponse(reply="", needs_review=True, confidence=None, citations=[], model_code=_MODEL_CODE, model_id=model.model_id)

    provider = build_provider(state.settings)
    result: LlmResult | None = None
    try:
        result = await resilience.run(
            lambda: provider.generate(clean, body.language_code),
            breaker=state.breakers["llm"], timeout_ms=state.settings.http_timeout_ms, retries=1,
        )
    except Exception:  # noqa: BLE001 — no key / breaker open / model error → degrade (never fabricate)
        state.metrics.inc('ai_assistant_degraded_total')
        await _safe_record(state, caller, model, body.language_code, status="needs_review", confidence=None, reasons=[])
        return AssistantResponse(reply="", needs_review=True, confidence=None, citations=[], model_code=_MODEL_CODE, model_id=model.model_id)

    review = needs_review(result.confidence or 0.0, model.confidence_threshold)
    state.metrics.inc('ai_assistant_total')
    await _safe_record(state, caller, model, body.language_code, status=("needs_review" if review else "answered"), confidence=result.confidence, reasons=[])
    return AssistantResponse(
        reply="" if review else result.text,
        needs_review=review,
        confidence=result.confidence,
        citations=result.citations,
        model_code=_MODEL_CODE,
        model_id=model.model_id,
    )


async def _safe_record(state, caller, model, lang, *, status, confidence, reasons) -> None:  # noqa: ANN001
    """Best-effort inference logging — a log outage must not fail the response (Law 12). Pointers only: we record
    status/lang/flags, NEVER the message text (redact.safe_input_ref scrubs anything stray)."""
    try:
        import uuid
        await state.logger.record(InferenceRecord(
            tenant_id=caller.tenant_id,
            model_id=model.model_id,
            subject_type="assistant_message",
            subject_id=str(uuid.uuid4()),
            input_ref={"lang": lang, "status": status, "reasons": reasons[:5]},
            output={"status": status, "needs_review": status != "answered"},
            confidence=confidence,
        ))
    except Exception:  # noqa: BLE001
        state.metrics.inc('ai_assistant_log_error_total')
