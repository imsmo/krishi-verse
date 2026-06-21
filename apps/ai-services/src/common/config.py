# apps/ai-services/src/common/config.py · fail-closed configuration (guide §4). ai-services is an INTERNAL
# inference tier — only apps/api / apps/worker / apps/stream-processor call it, over a shared secret. In
# production it REFUSES TO START with a weak/missing secret or no inference-log DB (so a misconfig can't expose
# an unauthenticated model endpoint). Provider keys (LLM/STT) are optional — without them those paths degrade
# to a low-confidence "needs_review" result rather than failing (Law 12). Secrets are never logged.
from __future__ import annotations

import os
from dataclasses import dataclass

_WEAK_PREFIXES = ("dev", "test", "change", "secret", "password", "default")


def _is_weak(s: str | None) -> bool:
    if not s or len(s) < 32:
        return True
    return any(s.lower().startswith(w) for w in _WEAK_PREFIXES)


@dataclass(frozen=True)
class Settings:
    env: str
    prod: bool
    shared_secret: str
    inference_log_db_url: str
    anthropic_api_key: str | None
    google_stt_key: str | None
    http_timeout_ms: int
    request_max_bytes: int

    @property
    def llm_enabled(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def stt_enabled(self) -> bool:
        return bool(self.google_stt_key)


def load_settings(env: dict[str, str] | None = None) -> Settings:
    e = env if env is not None else dict(os.environ)
    prod = e.get("APP_ENV", e.get("NODE_ENV", "development")) == "production"
    s = Settings(
        env=e.get("APP_ENV", "development"),
        prod=prod,
        shared_secret=e.get("API_SHARED_SECRET", ""),
        inference_log_db_url=e.get("INFERENCE_LOG_DB_URL", ""),
        anthropic_api_key=e.get("ANTHROPIC_API_KEY") or None,
        google_stt_key=e.get("GOOGLE_STT_KEY") or None,
        http_timeout_ms=int(e.get("AI_HTTP_TIMEOUT_MS", "8000")),
        request_max_bytes=int(e.get("AI_REQUEST_MAX_BYTES", str(256 * 1024))),
    )
    problems: list[str] = []
    if prod and _is_weak(s.shared_secret):
        problems.append("API_SHARED_SECRET (unique random >=32 chars)")
    if prod and not s.inference_log_db_url:
        problems.append("INFERENCE_LOG_DB_URL")
    if problems:
        raise RuntimeError("ai-services refusing to start — insecure config: " + ", ".join(problems))
    return s
