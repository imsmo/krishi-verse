# apps/ai-services/src/voice_extraction/extractor.py · parse + VALIDATE the LLM's JSON into a clean draft listing.
# The parse/normalise/validate path is PURE + unit-tested (the security-relevant part: never trust the model's
# output — reject unknown keys, coerce types, drop hallucinated/invalid values, keep price as STRING minor units
# per Law 2). The actual provider call lives in `extract` (httpx, resilience-wrapped, degrade-not-die): if the
# LLM is unavailable it returns an empty draft at confidence 0 so the caller falls back to manual entry — it
# never raises into the request path.
from __future__ import annotations

import json
from typing import Any

from .prompts import ALLOWED_FIELDS

_UNITS = {"kg", "quintal", "tonne", "dozen", "piece"}
_PRICE_RE = __import__("re").compile(r"^\d{1,19}$")


def normalise_listing(raw: dict[str, Any] | None) -> dict[str, Any]:
    """Coerce the model's object to the allowed shape. Unknown keys dropped; bad values → None (never guessed)."""
    out: dict[str, Any] = {k: None for k in ALLOWED_FIELDS}
    if not isinstance(raw, dict):
        return out
    cn = raw.get("crop_name")
    if isinstance(cn, str) and cn.strip():
        out["crop_name"] = cn.strip()[:80]
    q = raw.get("quantity")
    if isinstance(q, (int, float)) and not isinstance(q, bool) and q > 0:
        out["quantity"] = float(q)
    u = raw.get("unit")
    if isinstance(u, str) and u in _UNITS:
        out["unit"] = u
    pm = raw.get("price_minor")
    if isinstance(pm, str) and _PRICE_RE.match(pm):
        out["price_minor"] = pm                              # STRING minor units (Law 2) — never floated
    elif isinstance(pm, int) and not isinstance(pm, bool) and pm >= 0:
        out["price_minor"] = str(pm)
    if isinstance(raw.get("is_organic"), bool):
        out["is_organic"] = raw["is_organic"]
    g = raw.get("grade")
    if isinstance(g, str) and g.strip():
        out["grade"] = g.strip()[:20]
    return out


def parse_llm_json(text: str) -> dict[str, Any]:
    """Parse the model's response to a normalised listing. Tolerates fenced code blocks; bad JSON → empty draft."""
    s = (text or "").strip()
    if s.startswith("```"):
        s = s.strip("`")
        nl = s.find("\n")
        if nl >= 0:
            s = s[nl + 1:]
    try:
        obj = json.loads(s)
    except Exception:  # noqa: BLE001
        return normalise_listing(None)
    return normalise_listing(obj if isinstance(obj, dict) else None)


# --- provider boundary (degrade-never-die) ---------------------------------------------------------------

async def call_llm(prompt_system: str, prompt_user: str, *, api_key: str, timeout_ms: int) -> str:
    """Call the LLM provider over HTTP. Imported lazily; raises on transport error (caller wraps in resilience)."""
    import httpx

    async with httpx.AsyncClient(timeout=timeout_ms / 1000) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": "claude-3-haiku-20240307", "max_tokens": 400,
                  "system": prompt_system, "messages": [{"role": "user", "content": prompt_user}]},
        )
        resp.raise_for_status()
        data = resp.json()
        parts = data.get("content") or []
        return parts[0].get("text", "") if parts else ""
