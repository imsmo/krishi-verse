# apps/ai-services/src/common/resilience.py · degrade-never-die wrapper for external calls (LLM, STT) — guide §6.
# Composition: timeout → retry-with-backoff → circuit-breaker. A hung/dead provider must NEVER cascade into a
# request thread; when the breaker is open or retries are exhausted, the caller catches and returns a low-
# confidence "needs_review" result (the inference path degrades, it doesn't fail). The CircuitBreaker state
# machine is pure + unit-tested; `run` adds async timeout + jittered backoff.
from __future__ import annotations

import asyncio
import random
from dataclasses import dataclass
from typing import Awaitable, Callable, TypeVar

T = TypeVar("T")


class CircuitOpenError(RuntimeError):
    pass


@dataclass
class BreakerConfig:
    failure_threshold: int = 5
    reset_ms: int = 15_000
    half_open_max: int = 2


class CircuitBreaker:
    """closed → (failures≥threshold) → open → (after reset_ms) half_open → (success) closed | (fail) open."""

    def __init__(self, cfg: BreakerConfig | None = None, now_ms: Callable[[], int] | None = None) -> None:
        self.cfg = cfg or BreakerConfig()
        self._now = now_ms or (lambda: int(asyncio.get_event_loop().time() * 1000) if _loop_running() else 0)
        self.state = "closed"
        self.failures = 0
        self.opened_at = 0
        self.half_open_calls = 0

    def allow(self, now: int | None = None) -> bool:
        t = now if now is not None else self._now()
        if self.state == "open":
            if t - self.opened_at >= self.cfg.reset_ms:
                self.state = "half_open"
                self.half_open_calls = 0
                return True
            return False
        if self.state == "half_open":
            return self.half_open_calls < self.cfg.half_open_max
        return True

    def on_success(self) -> None:
        self.state = "closed"
        self.failures = 0
        self.half_open_calls = 0

    def on_failure(self, now: int | None = None) -> None:
        t = now if now is not None else self._now()
        self.failures += 1
        if self.state == "half_open" or self.failures >= self.cfg.failure_threshold:
            self.state = "open"
            self.opened_at = t


def backoff_ms(attempt: int, base_ms: int = 100, max_ms: int = 4000, rand: Callable[[], float] = random.random) -> int:
    """Exponential backoff with full jitter, capped."""
    exp = min(max_ms, base_ms * 2 ** max(0, attempt - 1))
    return int(rand() * exp)


def _loop_running() -> bool:
    try:
        asyncio.get_running_loop()
        return True
    except RuntimeError:
        return False


async def run(
    fn: Callable[[], Awaitable[T]],
    *,
    breaker: CircuitBreaker,
    timeout_ms: int,
    retries: int = 2,
) -> T:
    """Run `fn` with breaker + timeout + retry. Raises CircuitOpenError if the breaker is open, or the last
    error after exhausting retries — the CALLER degrades (returns needs_review), it doesn't crash."""
    if not breaker.allow():
        raise CircuitOpenError("circuit open")
    if breaker.state == "half_open":
        breaker.half_open_calls += 1
    last: Exception | None = None
    for attempt in range(1, retries + 2):
        try:
            result = await asyncio.wait_for(fn(), timeout=timeout_ms / 1000)
            breaker.on_success()
            return result
        except Exception as e:  # noqa: BLE001 — provider/transport errors are all transient here
            last = e
            breaker.on_failure()
            if attempt <= retries:
                await asyncio.sleep(backoff_ms(attempt) / 1000)
    assert last is not None
    raise last
