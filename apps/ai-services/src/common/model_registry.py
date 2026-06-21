# apps/ai-services/src/common/model_registry.py · resolves the ACTIVE model for a code from the ai_models registry
# (db/migrations/0013). Lifecycle authoring (shadow→canary→production→retired) is admin-api's job (Law 11); this
# service only READS the registry to stamp model_id + confidence_threshold on each inference. Prefers
# 'production', falls back to 'canary'. Cached briefly (the registry changes rarely; a stale cache is bounded by
# TTL). If a model isn't registered, inference still runs but is logged with a null model + threshold 0 and is
# always flagged for review (fail-closed: an un-governed model never auto-passes).
from __future__ import annotations

import time
from dataclasses import dataclass

from .db import Db

_CACHE_TTL_S = 60


@dataclass(frozen=True)
class ActiveModel:
    model_id: str | None
    code: str
    version: str
    status: str
    confidence_threshold: float    # 0 when unknown → everything is reviewed (fail-closed)


class ModelRegistry:
    def __init__(self, db: Db) -> None:
        self._db = db
        self._cache: dict[str, tuple[float, ActiveModel]] = {}

    async def active(self, code: str) -> ActiveModel:
        hit = self._cache.get(code)
        now = time.monotonic()
        if hit and now - hit[0] < _CACHE_TTL_S:
            return hit[1]
        row = await self._db.fetchrow(
            """SELECT id::text AS id, version, status, confidence_threshold
                 FROM ai_models
                WHERE code = $1 AND status IN ('production','canary')
                ORDER BY (status='production') DESC, version DESC
                LIMIT 1""",
            [code],
        )
        if row is None:
            model = ActiveModel(model_id=None, code=code, version="unregistered", status="none", confidence_threshold=0.0)
        else:
            model = ActiveModel(
                model_id=row["id"],
                code=code,
                version=str(row["version"]),
                status=str(row["status"]),
                confidence_threshold=float(row["confidence_threshold"]) if row["confidence_threshold"] is not None else 0.0,
            )
        self._cache[code] = (now, model)
        return model


def needs_review(confidence: float, threshold: float) -> bool:
    """A decision below the model's confidence threshold goes to the human review queue (Law 11). An unregistered
    model (threshold 0) still reviews everything via the >=-with-unregistered rule below."""
    if threshold <= 0:
        return True                 # un-governed model ⇒ always review (fail-closed)
    return confidence < threshold
