# apps/ai-services/src/common/http.py · shared FastAPI plumbing: the service-to-service auth dependency + a
# request-size guard. Every router depends on require_caller, which verifies the shared bearer (constant-time)
# against the booted settings and parses the trusted tenant/request-id headers. FAIL CLOSED: a bad/missing
# secret raises 401 before any handler logic runs. App singletons (settings, db, registry, logger, metrics) live
# on app.state, set in the lifespan (main.py).
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import Header, HTTPException, Request

from .auth import CallerContext, parse_caller, verify_secret


@dataclass
class AppState:
    settings: Any
    db: Any
    registry: Any
    logger: Any
    metrics: Any
    breakers: Any   # dict[str, CircuitBreaker] for external providers (llm, stt, …)


async def require_caller(
    request: Request,
    authorization: str | None = Header(default=None),
    x_tenant_id: str | None = Header(default=None),
    x_request_id: str | None = Header(default=None),
    x_caller: str | None = Header(default=None),
) -> CallerContext:
    state: AppState = request.app.state.app
    if not verify_secret(authorization, state.settings.shared_secret):
        state.metrics.inc("ai_auth_failed_total")
        raise HTTPException(status_code=401, detail="unauthorized")     # throws, never logs-and-continues
    return parse_caller(x_tenant_id, x_request_id, x_caller)


def guard_body_size(raw_len: int, settings: Any) -> None:
    if raw_len > settings.request_max_bytes:
        raise HTTPException(status_code=413, detail="payload too large")
