# apps/ai-services/src/common/inference_logger.py · writes ai_inferences — the append-only audit of every
# consequential AI decision (db/migrations/0013). This service is the PRODUCER of inferences, so it records the
# row itself; ai-governance only reads/reviews it. Hard rules:
#   • input_ref is POINTERS ONLY — passed through redact.safe_input_ref so raw audio/transcript/PII can never land.
#   • tenant_id is set via with_tenant so RLS holds + the row is tenant-stamped; cross-tenant reads never happen.
#   • was_overridden=false here (a human override is stamped later by the review flow); confidence + output stored.
#   • This is ADVISORY logging — recording an inference never moves money or changes an account (Law 11).
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from .db import Db
from .redact import safe_input_ref

_INSERT = """INSERT INTO ai_inferences
  (tenant_id, model_id, subject_type, subject_id, input_ref, output, confidence, was_overridden, created_at)
  VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, false, now())"""


@dataclass(frozen=True)
class InferenceRecord:
    tenant_id: str | None
    model_id: str | None
    subject_type: str
    subject_id: str
    input_ref: dict[str, Any]
    output: dict[str, Any]
    confidence: float | None


class InferenceLogger:
    def __init__(self, db: Db) -> None:
        self._db = db

    async def record(self, rec: InferenceRecord) -> None:
        """Persist one inference. input_ref is scrubbed to pointers; tenant_id is set so RLS holds."""
        safe_ref = safe_input_ref(rec.input_ref)
        await self._db.with_tenant(
            rec.tenant_id,
            _INSERT,
            [
                rec.tenant_id,
                rec.model_id,
                rec.subject_type[:50],
                rec.subject_id,
                json.dumps(safe_ref),
                json.dumps(rec.output),
                rec.confidence,
            ],
        )
