# apps/ai-services/src/assistant/guardrails.py · PURE second-layer prompt-injection + sanitation guard (the api
# tier runs the first layer; defence-in-depth). No I/O → unit-tested. Bounds length, strips control chars, and
# scans for the common jailbreak / instruction-override / exfiltration families. A hit means the router REFUSES
# (records a blocked inference, returns needs_review) — the model is never invoked on a flagged prompt.
from __future__ import annotations

import re

MAX_MESSAGE_CHARS = 2000
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_WS_RE = re.compile(r"[ \t\r\n]{2,}")

_INJECTION_RES: list[tuple[str, re.Pattern[str]]] = [
    ("override_instructions", re.compile(r"\bignore (all |the |your )?(previous|prior|above) (instructions|prompts?|rules)\b")),
    ("override_instructions", re.compile(r"\bdisregard (all |the |your )?(previous|prior|above|system)\b")),
    ("reveal_system_prompt", re.compile(r"\b(reveal|show|print|repeat|output|leak) (me )?(your |the )?(system |initial )?(prompt|instructions|rules)\b")),
    ("role_jailbreak", re.compile(r"\b(you are|act as|pretend to be|roleplay as) (now )?(dan|an? (unrestricted|jailbroken|uncensored)|a different ai)\b")),
    ("developer_mode", re.compile(r"\b(developer|debug|god|admin) mode\b")),
    ("exfiltrate_secret", re.compile(r"\b(api[_ ]?key|secret|password|token|env(ironment)? variable|credentials?)\b")),
    ("tool_escape", re.compile(r"(^|\s)(system|assistant|user)\s*:")),
]


def sanitize_message(raw: str) -> str:
    no_control = _CONTROL_RE.sub(" ", raw or "")
    collapsed = _WS_RE.sub(" ", no_control).strip()
    return collapsed[:MAX_MESSAGE_CHARS]


def detect_injection(text: str) -> list[str]:
    hay = text.lower()
    hits: list[str] = []
    for code, rx in _INJECTION_RES:
        if rx.search(hay) and code not in hits:
            hits.append(code)
    return hits


def screen_message(raw: str) -> tuple[bool, str, list[str]]:
    """Returns (ok, clean, reasons). ok ⇒ safe to forward to the model."""
    clean = sanitize_message(raw)
    if not clean:
        return (False, clean, ["empty"])
    reasons = detect_injection(clean)
    return (len(reasons) == 0, clean, reasons)
