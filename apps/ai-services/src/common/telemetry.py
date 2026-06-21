# apps/ai-services/src/common/telemetry.py · structured JSON logging + in-process metrics (guide §6). Logs carry
# request_id + caller + model code, NEVER PII/secrets/raw inputs (the redact module is the backstop, but we also
# only ever log pointers/ids/durations here). Metrics are plain counters/timers exposed at /metrics in Prometheus
# text. Stdlib-only so it imports cleanly without extra deps.
from __future__ import annotations

import json
import logging
import sys
import time
from typing import Any

_SENSITIVE = ("secret", "token", "password", "authorization", "api_key", "transcript", "audio")


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        base: dict[str, Any] = {
            "ts": int(record.created * 1000),
            "level": record.levelname,
            "msg": record.getMessage(),
        }
        extra = getattr(record, "fields", None)
        if isinstance(extra, dict):
            for k, v in extra.items():
                if not any(s in str(k).lower() for s in _SENSITIVE):
                    base[k] = v
        return json.dumps(base, separators=(",", ":"), default=str)


def get_logger(name: str = "ai-services") -> logging.Logger:
    log = logging.getLogger(name)
    if not log.handlers:
        h = logging.StreamHandler(sys.stdout)
        h.setFormatter(_JsonFormatter())
        log.addHandler(h)
        log.setLevel(logging.INFO)
        log.propagate = False
    return log


class Metrics:
    """Coarse in-process counters/timers. Labels never carry tenant/user id or PII — only model code + outcome."""

    def __init__(self) -> None:
        self._c: dict[str, int] = {}
        self._t: dict[str, tuple[int, int]] = {}     # key -> (count, total_ms)

    def inc(self, key: str, n: int = 1) -> None:
        self._c[key] = self._c.get(key, 0) + n

    def observe_ms(self, key: str, ms: int) -> None:
        c, tot = self._t.get(key, (0, 0))
        self._t[key] = (c + 1, tot + ms)

    def render(self) -> str:
        lines = [f"{k} {v}" for k, v in self._c.items()]
        for k, (c, tot) in self._t.items():
            lines.append(f"{k}_count {c}")
            lines.append(f"{k}_avg_ms {tot // c if c else 0}")
        return "\n".join(lines) + "\n"


class Timer:
    def __init__(self) -> None:
        self._t0 = time.monotonic()

    def ms(self) -> int:
        return int((time.monotonic() - self._t0) * 1000)
