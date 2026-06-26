# apps/ai-services/src/doc_extraction/router.py · POST /v1/doc-extraction — document text → structured draft
# listing (P1-16-AI). Service-to-service authed; ADVISORY only (Law 11 — the api tier owns the on-behalf consent
# gate + the ambassador's confirm). Mirrors the voice path: the doc text is TRANSIENT (used for the LLM call,
# NEVER persisted); only the structured output + pointers (media_ids, doc_type, locale) are logged to
# ai_inferences. Degrades: if the LLM is unavailable/disabled, returns an EMPTY draft at confidence 0 so the app
# falls back to manual entry — it never raises into the request path and never fabricates field values (Law 12).
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from ..common.auth import CallerContext
from ..common.http import require_caller
from ..common.inference_logger import InferenceRecord
from ..common.model_registry import needs_review
from ..common.resilience import run as resilient_run, CircuitOpenError
from ..voice_extraction.extractor import parse_llm_json, call_llm   # reuse the validated parse/normalise + provider call
from .confidence import overall_confidence
from .prompts import SYSTEM_PROMPT, build_user_prompt

router = APIRouter(prefix="/v1/doc-extraction", tags=["doc-extraction"])
_MODEL_CODE = "doc_listing_extract"


class DocRequest(BaseModel):
    model_config = {"extra": "forbid"}
    doc_text: str = Field(min_length=1, max_length=4000)        # transient; never stored
    locale: str = Field(default="hi", pattern="^(hi|en|gu)$")
    doc_type: str = Field(default="listing", pattern="^(listing|scheme)$")
    media_ids: list[str] = Field(default_factory=list, max_length=10)   # pointers for the audit log
    tenant_id: str | None = Field(default=None, max_length=64)


class DocResponse(BaseModel):
    draft: dict
    confidence: float
    needs_review: bool
    model_code: str
    model_id: str | None


@router.post("", response_model=DocResponse)
async def extract(body: DocRequest, request: Request, caller: CallerContext = Depends(require_caller)) -> DocResponse:
    state = request.app.state.app
    model = await state.registry.active(_MODEL_CODE)
    draft: dict = {}
    if state.settings.llm_enabled:
        try:
            text = await resilient_run(
                lambda: call_llm(SYSTEM_PROMPT, build_user_prompt(body.doc_text, body.locale, body.doc_type),
                                 api_key=state.settings.anthropic_api_key, timeout_ms=state.settings.http_timeout_ms),
                breaker=state.breakers["llm"], timeout_ms=state.settings.http_timeout_ms, retries=1,
            )
            draft = parse_llm_json(text)
        except (CircuitOpenError, Exception):  # noqa: BLE001 — degrade to manual entry, never raise/fabricate
            state.metrics.inc("ai_doc_extract_degraded_total")
            draft = parse_llm_json("")
    else:
        draft = parse_llm_json("")

    conf = overall_confidence(draft) if state.settings.llm_enabled else 0.0
    review = needs_review(conf, model.confidence_threshold)
    state.metrics.inc("ai_doc_extract_total")
    try:
        await state.logger.record(InferenceRecord(
            tenant_id=caller.tenant_id, model_id=model.model_id, subject_type="doc_listing",
            subject_id=(body.media_ids[0] if body.media_ids else caller.request_id),
            input_ref={"media_ids": body.media_ids[:10], "doc_type": body.doc_type, "locale": body.locale},  # NO doc text
            output={"draft": draft, "needs_review": review}, confidence=conf,
        ))
    except Exception:  # noqa: BLE001
        state.metrics.inc("ai_inference_log_fail_total")
    return DocResponse(draft=draft, confidence=conf, needs_review=review, model_code=_MODEL_CODE, model_id=model.model_id)
